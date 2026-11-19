import { useQuery } from "@tanstack/react-query";
import { SquareTerminal } from "lucide-react";
import { api } from "../api";
import CommandRunner from "../components/CommandRunner.jsx";
import { Empty, ErrorBox, PageHeader } from "../components/ui.jsx";

export default function Commands() {
  const { data: vms, error } = useQuery({ queryKey: ["vms"], queryFn: api.vms });
  return (
    <>
      <PageHeader title="Run commands" subtitle="Run a command on all VMs or a selection, in parallel. Output is captured per VM." />
      <ErrorBox error={error} />
      {vms && (vms.length ? <CommandRunner vms={vms} /> : <Empty icon={SquareTerminal} title="No VMs">Add a VM first.</Empty>)}
    </>
  );
}
