import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import CommandRunner from "../components/CommandRunner.jsx";
import { Empty, ErrorBox } from "../components/ui.jsx";

export default function Commands() {
  const { data: vms, error } = useQuery({ queryKey: ["vms"], queryFn: api.vms });
  return (
    <>
      <h1>Run commands</h1>
      <p className="muted">Commands run in parallel over SSH as the user InstaBox connects you as. Output is captured per VM.</p>
      <ErrorBox error={error} />
      {vms && (vms.length ? <CommandRunner vms={vms} /> : <Empty>Add a VM first.</Empty>)}
    </>
  );
}
