// Reject obviously dangerous fields unless explicitly whitelisted.
// You can expand this into a proper admission-like validator later.

export function sanitizeManifest(doc: any, opts?: { allowHostPath?: boolean }) {
  const errors: string[] = [];

  // Check PodSpec-level dangerous fields
  const spec = doc.spec || {};
  // For Deployments/StatefulSet etc: get pod template spec
  const podSpec = (doc.kind === "Deployment" || doc.kind === "StatefulSet" || doc.kind === "DaemonSet" || doc.kind === "Job" || doc.kind === "CronJob")
    ? ((doc.spec.template && doc.spec.template.spec) || doc.spec.jobTemplate?.spec?.template?.spec)
    : spec;

  if (podSpec) {
    if (podSpec.hostNetwork) errors.push("hostNetwork is forbidden");
    if (podSpec.hostPID) errors.push("hostPID is forbidden");
    if (podSpec.hostIPC) errors.push("hostIPC is forbidden");

    // container securityContext/privileged
    const containers = podSpec.containers || [];
    containers.forEach((c: any, idx: number) => {
      if (c.securityContext && c.securityContext.privileged) {
        errors.push(`container[${idx}].securityContext.privileged is forbidden`);
      }
      if (c.securityContext && c.securityContext.runAsUser && c.securityContext.runAsUser === 0) {
        // optional: allow root? we can warn but not fail. For now warn.
        // errors.push(`container[${idx}].securityContext.runAsUser=0 (root) — consider non-root`);
      }
    });

    // volumes hostPath checks
    const volumes = podSpec.volumes || [];
    volumes.forEach((v: any, idx: number) => {
      if (v.hostPath && !opts?.allowHostPath) {
        errors.push(`volumes[${idx}] uses hostPath which is forbidden by default`);
      }
    });
  }

  if (errors.length) {
    return { ok: false, errors };
  }
  return { ok: true };
}
