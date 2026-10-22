// The reusable Studio file bar expects a service provider. This standalone
// consumer has no managed Studio account or Switchboard binding. Refuse those
// calls explicitly; never manufacture a user, admission, or successful write.
const unavailable = async () => {
  const error = new Error('Managed Studio services are not connected in this personal app.');
  error.code = 'STUDIO_SERVICE_UNBOUND';
  throw error;
};
export const base44 = Object.freeze({
  auth: Object.freeze({ me: unavailable, updateMe: unavailable }),
  functions: Object.freeze({ invoke: unavailable }),
  entities: new Proxy({}, { get: () => new Proxy({}, { get: () => unavailable }) }),
});
