import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { ErrorBox, Modal } from "./ui";

export default function AddVM({ onClose }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ name: "", ssh_command: "", private_key: "", tags: "", notes: "" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const m = useMutation({
    mutationFn: () => api.addVm({
      name: f.name, ssh_command: f.ssh_command, private_key: f.private_key || null,
      tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean), notes: f.notes,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vms"] }); onClose(); },
  });
  return (
    <Modal title="Add VM" onClose={onClose}>
      <label>Name<input value={f.name} onChange={set("name")} placeholder="web-01" autoFocus /></label>
      <label>SSH command (as shown by InstaBox)
        <input value={f.ssh_command} onChange={set("ssh_command")} placeholder="ssh <secret-code>@ssh.instabox.sh" className="mono" />
      </label>
      <label>Private key (optional, only if your command needs one)
        <textarea rows={3} value={f.private_key} onChange={set("private_key")} className="mono" placeholder="-----BEGIN OPENSSH PRIVATE KEY-----" />
      </label>
      <label>Tags (comma separated)<input value={f.tags} onChange={set("tags")} placeholder="prod, web" /></label>
      <label>Notes<input value={f.notes} onChange={set("notes")} /></label>
      <p className="hint">The connection is tested before saving. The secret code is encrypted at rest and never shown again.</p>
      <ErrorBox error={m.error} />
      <div className="row end">
        <button className="ghost" onClick={onClose}>Cancel</button>
        <button disabled={!f.name.trim() || !f.ssh_command.trim() || m.isPending} onClick={() => m.mutate()}>
          {m.isPending ? "Connecting…" : "Add & test"}
        </button>
      </div>
    </Modal>
  );
}
