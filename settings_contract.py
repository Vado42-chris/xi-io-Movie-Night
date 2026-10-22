"""Consume the app manifest's versioned declaration, without changing stored data.

This consumer supports only the JSON Schema keywords used by this declaration.
Unsupported validation keywords fail loading instead of being silently ignored.
Shared framework/DataForge registration and runtime qualification remain separate.
"""
import copy
import json
import math
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
META = "x-xiio"
KEYWORDS = {"$schema", "$id", "title", "description", "type", "additionalProperties",
            "required", "properties", "enum", "minimum", "maximum", "minLength",
            "maxLength", "pattern", "default", META}

class DeclarationError(ValueError):
    pass


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise DeclarationError("Duplicate declaration key")
        result[key] = value
    return result


def accepts(node, value):
    kind = node.get("type")
    if kind == "object":
        if not isinstance(value, dict) or set(value) != set(node["properties"]):
            return False
        return all(accepts(rule, value[key]) for key, rule in node["properties"].items())
    if kind == "boolean":
        if type(value) is not bool:
            return False
    elif kind == "integer":
        if type(value) not in (int, float) or (type(value) is float and (not math.isfinite(value) or not value.is_integer())):
            return False
        if value < node.get("minimum", -math.inf) or value > node.get("maximum", math.inf):
            return False
    elif kind == "string":
        if not isinstance(value, str) or not node.get("minLength", 0) <= len(value) <= node.get("maxLength", math.inf):
            return False
        if "pattern" in node and re.search(node["pattern"], value) is None:
            return False
    else:
        return False
    return "enum" not in node or value in node["enum"]


def defaults(node):
    if node["type"] == "object":
        return {key: defaults(rule) for key, rule in node["properties"].items()}
    return copy.deepcopy(node["default"])


def qualify(declaration):
    if not isinstance(declaration, dict) or not isinstance(declaration.get(META), dict):
        raise DeclarationError("Settings declaration metadata missing")
    meta = declaration[META]
    required = {"declaration_version", "owner", "record_schema", "maximum_revision", "scope",
                "binding_registry", "read", "write", "reset", "import", "export", "section_order"}
    if not required <= set(meta) or any(not meta[key] for key in required):
        raise DeclarationError("Settings declaration metadata incomplete")
    sections = declaration.get("properties", {})
    if not isinstance(sections, dict) or set(meta["section_order"]) != set(sections) or len(meta["section_order"]) != len(sections):
        raise DeclarationError("Settings section conflict")
    def walk(node, pointer=""):
        if not isinstance(node, dict) or set(node) - KEYWORDS:
            raise DeclarationError("Unsupported declaration keyword")
        kind = node.get("type")
        if kind == "object":
            properties = node.get("properties")
            if (not isinstance(properties, dict) or not properties or node.get("additionalProperties") is not False
                    or set(node.get("required", [])) != set(properties) or len(node.get("required", [])) != len(properties)):
                raise DeclarationError("Incomplete object declaration")
            for key, child in properties.items():
                if not re.fullmatch(r"[a-z][a-z0-9_]*", key):
                    raise DeclarationError("Invalid setting key")
                walk(child, pointer + "/" + key)
            return
        m = node.get(META, {})
        if kind not in {"boolean", "integer", "string"} or "default" not in node or not accepts(node, node["default"]):
            raise DeclarationError("Invalid declared default")
        if (m.get("owner") != meta["owner"] or m.get("scope") != meta["scope"] or m.get("pointer") != pointer
                or m.get("read_binding") != meta["read"] or m.get("write_binding") != meta["write"]):
            raise DeclarationError("Settings owner, scope or binding conflict")
        if set(m.get("permissions", {})) != {"read", "write"} or not all(m["permissions"].values()):
            raise DeclarationError("Setting permissions missing")
        if set(m.get("operations", {})) != {"import", "export", "reset"} or any(type(x) is not bool for x in m["operations"].values()):
            raise DeclarationError("Setting operation policy missing")
        control = m.get("control", {})
        if control.get("type") not in {"toggle", "range", "select", "select-number", "model"}:
            raise DeclarationError("Setting control metadata missing")
        if "enum" in node:
            values = node["enum"]
            if not isinstance(values, list) or not values or len({json.dumps(v) for v in values}) != len(values):
                raise DeclarationError("Conflicting allowed values")
            if set(control.get("option_labels", {})) != {str(v) for v in values}:
                raise DeclarationError("Option label mismatch")
        if not m.get("effect", {}).get("consumer_ref") or not m["effect"].get("apply_when"):
            raise DeclarationError("Setting effect consumer missing")
    walk(declaration)
    return declaration


def load_declaration():
    manifest = json.loads((ROOT / "xiio/managed-project.manifest.json").read_text(), object_pairs_hook=unique_object)
    entries = [row for row in manifest["documentation"]["required_artifacts"] if row.get("artifact_type") == "settings_declaration"]
    if len(entries) != 1:
        raise DeclarationError("Exactly one settings declaration must be referenced")
    path = (ROOT / entries[0]["path"]).resolve()
    if not path.is_relative_to(ROOT) or path.suffix != ".json":
        raise DeclarationError("Unsafe settings declaration reference")
    declaration = json.loads(path.read_text(), object_pairs_hook=unique_object)
    if declaration.get(META, {}).get("owner") != manifest["project_id"]:
        raise DeclarationError("Manifest settings owner mismatch")
    return qualify(declaration)

DECLARATION = load_declaration()
