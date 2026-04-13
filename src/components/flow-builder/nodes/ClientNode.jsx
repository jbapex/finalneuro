import React, { memo, useEffect } from 'react';
import { Handle, Position } from 'reactflow';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { FlowNodeHeaderDelete } from '@/components/flow-builder/FlowNodeHeaderDelete';

const ClientNode = memo(({ data, id, selected }) => {
  const { onUpdateNodeData, clients, selectedClientId } = data;

  // Ao carregar o fluxo com cliente já selecionado, buscar client_contexts
  useEffect(() => {
    if (!selectedClientId || !clients?.length || !onUpdateNodeData) return;
    const selectedClientData = clients.find(c => c.id.toString() === selectedClientId);
    if (!selectedClientData) return;
    let cancelled = false;
    (async () => {
      const { data: contexts } = await supabase
        .from('client_contexts')
        .select('id, name, content')
        .eq('client_id', selectedClientData.id)
        .order('created_at', { ascending: true });
      if (cancelled) return;
      onUpdateNodeData(id, {
        output: {
          id: selectedClientId,
          data: { ...selectedClientData, client_contexts: contexts || [] }
        }
      });
    })();
    return () => { cancelled = true; };
  }, [selectedClientId, clients, id, onUpdateNodeData]);

  const handleClientChange = async (clientId) => {
    const selectedClientData = clients.find(c => c.id.toString() === clientId);
    if (!selectedClientData) {
      onUpdateNodeData(id, { selectedClientId: null, output: null });
      return;
    }
    const { data: contexts } = await supabase
      .from('client_contexts')
      .select('id, name, content')
      .eq('client_id', selectedClientData.id)
      .order('created_at', { ascending: true });
    onUpdateNodeData(id, { 
      selectedClientId: clientId, 
      output: { 
        id: clientId,
        data: { ...selectedClientData, client_contexts: contexts || [] }
      }
    });
  };

  return (
    <Card className="w-64 border-2 border-primary/50 shadow-lg">
      <Handle type="target" position={Position.Left} className="!bg-primary" />
      <CardHeader className="flex flex-row items-center gap-2 p-3 bg-primary/10 min-w-0">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Users className="w-5 h-5 shrink-0 text-primary" />
          <CardTitle className="text-base truncate">Cliente</CardTitle>
        </div>
        <FlowNodeHeaderDelete nodeId={id} onRemoveNode={data.onRemoveNode} selected={selected} />
      </CardHeader>
      <CardContent className="p-3">
        <Select onValueChange={handleClientChange} value={selectedClientId}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione um cliente..." />
          </SelectTrigger>
          <SelectContent>
            {clients?.map((client) => (
              <SelectItem key={client.id} value={client.id.toString()}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
      <Handle type="source" position={Position.Right} className="!bg-primary" />
    </Card>
  );
});

export default ClientNode;