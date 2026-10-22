"""Isolated parity/reset checks. Never read or write the owner's preferences."""
import ast
import copy
import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import app_settings as store
import settings_contract as contract

ROOT = Path(__file__).resolve().parent

class ContractTests(unittest.TestCase):
    def node(self, script, payload):
        run = subprocess.run(['node', '--input-type=module', '-e', script], input=json.dumps(payload),
                             cwd=ROOT, text=True, capture_output=True, timeout=15, check=True)
        return json.loads(run.stdout)

    def test_original_defaults_and_disk_schema_are_unchanged(self):
        original = subprocess.run(['git','show','7f696f04a71c4d924a77dbb609650db36ccecf12:app_settings.py'],
                                  cwd=ROOT, capture_output=True, text=True, check=True).stdout
        previous = next(ast.literal_eval(n.value) for n in ast.parse(original).body
                        if isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'DEFAULTS' for t in n.targets))
        self.assertEqual(previous, store.DEFAULTS)
        self.assertEqual(store.SCHEMA, 'movie-night.settings/v1')

    def test_python_and_browser_validation_agree(self):
        cases = [copy.deepcopy(store.DEFAULTS)]
        for section, fields in contract.DECLARATION['properties'].items():
            for key, rule in fields['properties'].items():
                choices = [None, True, False, 0, 1, -1, 1.5, '', 'invalid', [], {}, rule['default']]
                choices += rule.get('enum', [])
                if 'minimum' in rule: choices += [rule['minimum']-1,rule['minimum'],rule['maximum'],rule['maximum']+1]
                for value in choices:
                    item=copy.deepcopy(store.DEFAULTS); item[section][key]=value; cases.append(item)
        for value in ['model:tag','org/model:tag','model\n',' model','https://secret.invalid','x'*161]:
            item=copy.deepcopy(store.DEFAULTS); item['concierge']['model']=value; cases.append(item)
        extra=copy.deepcopy(store.DEFAULTS);extra['unknown']=1;cases.append(extra)
        extra=copy.deepcopy(store.DEFAULTS);extra['browsing']['unknown']=1;cases.append(extra)
        observed=self.node("import fs from 'node:fs';import {accepts,qualify} from './web/settings-contract.mjs';const d=JSON.parse(fs.readFileSync(0,'utf8'));qualify(d.schema);console.log(JSON.stringify(d.cases.map(x=>accepts(d.schema,x))));",{'schema':contract.DECLARATION,'cases':cases})
        self.assertEqual(observed,[contract.accepts(contract.DECLARATION,x) for x in cases])

    def test_declared_permissions_and_missing_metadata_fail_closed(self):
        for can_import in (False,True):
            for can_export in (False,True):
                schema=copy.deepcopy(contract.DECLARATION)
                schema['properties']['browsing']['properties']['show_ratings']['x-xiio']['operations'].update({'import':can_import,'export':can_export})
                observed=self.node("import fs from 'node:fs';import {qualify,defaults,supportsTransfer} from './web/settings-contract.mjs';const d=qualify(JSON.parse(fs.readFileSync(0,'utf8')));console.log(JSON.stringify([supportsTransfer(d,'import'),supportsTransfer(d,'export')]));",schema)
                self.assertEqual(observed,[can_import,can_export])
        for field in ['owner','scope','read_binding','write_binding','permissions','operations','effect']:
            schema=copy.deepcopy(contract.DECLARATION)
            del schema['properties']['browsing']['properties']['show_ratings']['x-xiio'][field]
            with self.assertRaises(contract.DeclarationError):contract.qualify(schema)
            observed=self.node("import fs from 'node:fs';import {qualify} from './web/settings-contract.mjs';let ok=false;try{qualify(JSON.parse(fs.readFileSync(0,'utf8')));ok=true;}catch{}console.log(JSON.stringify(ok));",schema)
            self.assertFalse(observed)

    def test_scoped_reset_preserves_files_and_other_sections_and_conflicts(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(store,'STORE',Path(directory)/'runtime/app-settings.json'):
            first=copy.deepcopy(store.DEFAULTS);first['browsing']['show_ratings']=False;first['playback']['default_volume']=35
            record=store.update_document({'revision':0,'settings':first})
            unrelated=Path(directory)/'favorites.json';unrelated.write_bytes(b'USER_FILES_MUST_SURVIVE')
            reset=store.reset_document({'revision':record['revision'],'scope':'browsing'})
            self.assertEqual(reset['settings']['browsing'],store.DEFAULTS['browsing'])
            self.assertEqual(reset['settings']['playback']['default_volume'],35)
            self.assertEqual(unrelated.read_bytes(),b'USER_FILES_MUST_SURVIVE')
            self.assertEqual(reset,store.read_document())
            before=store.STORE.read_bytes()
            with self.assertRaises(store.SettingsError):store.reset_document({'revision':record['revision'],'scope':'application'})
            self.assertEqual(before,store.STORE.read_bytes())
            with self.assertRaises(store.SettingsError):store.reset_document({'revision':reset['revision'],'scope':'system'})

    def test_fresh_process_observes_plugin_effect_after_save_and_reset(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(store,'STORE',Path(directory)/'runtime/app-settings.json'):
            values=copy.deepcopy(store.DEFAULTS);values['plugins']['cinemeta_enabled']=False
            saved=store.update_document({'revision':0,'settings':values})
            code="import sys,json;from pathlib import Path;from types import SimpleNamespace;import app_settings as s;s.STORE=Path(sys.argv[1]);responses=[];h=SimpleNamespace(path='/api/browse?type=movie',headers={'Host':'localhost:8789'},server=SimpleNamespace(server_port=8789),json_response=lambda status,body:responses.append(status));print(json.dumps({'blocked':s.gate_catalogue(h),'statuses':responses}))"
            def probe():
                result=subprocess.run(['python3','-c',code,str(store.STORE)],cwd=ROOT,capture_output=True,text=True,check=True,timeout=10)
                return json.loads(result.stdout)
            self.assertEqual(probe(),{'blocked':True,'statuses':[503]})
            store.reset_document({'revision':saved['revision'],'scope':'plugins'})
            self.assertEqual(probe(),{'blocked':False,'statuses':[]})

if __name__ == '__main__': unittest.main()
