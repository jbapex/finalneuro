import React, { memo, useMemo } from 'react';
    import { Handle, Position } from 'reactflow';
    import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
    import { BrainCircuit, Loader2 } from 'lucide-react';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useToast } from '@/components/ui/use-toast';
    import { FlowNodeHeaderDelete } from '@/components/flow-builder/FlowNodeHeaderDelete';

    const PlanningNode = memo(({ data, id, selected }) => {
      const { onUpdateNodeData, inputData, selectedPlanningId, plannings } = data;
      const { toast } = useToast();

      const campaignId = inputData?.campaign?.id;

      const filteredPlannings = useMemo(() => {
        if (!plannings) return [];
        if (campaignId) {
          return plannings.filter(p => p.campaign_id?.toString() === campaignId.toString());
        }
        return [];
      }, [campaignId, plannings]);

      const handlePlanningChange = async (planningId) => {
        try {
          const { data: planningData, error } = await supabase
            .from('plannings')
            .select('*, planning_steps(*)')
            .eq('id', planningId)
            .single();
          if (error) throw error;

          onUpdateNodeData(id, {
            selectedPlanningId: planningId,
            output: {
              id: planningId,
              data: planningData,
            },
          });
        } catch (error) {
          toast({ title: 'Erro ao buscar detalhes do planejamento', description: error.message, variant: 'destructive' });
        }
      };
      
      const isDisabled = !campaignId;
      const placeholderText = isDisabled ? "Conecte uma campanha" : (filteredPlannings.length === 0 ? "Nenhum planejamento" : "Selecione um planejamento...");

      return (
        <Card className="w-64 border-2 border-purple-500/50 shadow-lg">
          <Handle type="target" position={Position.Left} className="!bg-purple-500" />
          <CardHeader className="flex flex-row items-center gap-2 p-3 bg-purple-500/10 min-w-0">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <BrainCircuit className="w-5 h-5 shrink-0 text-purple-500" />
              <CardTitle className="text-base truncate">Planejamento</CardTitle>
            </div>
            <FlowNodeHeaderDelete nodeId={id} onRemoveNode={data.onRemoveNode} selected={selected} />
          </CardHeader>
          <CardContent className="p-3">
            <Select onValueChange={handlePlanningChange} value={selectedPlanningId} disabled={isDisabled || filteredPlannings.length === 0}>
              <SelectTrigger>
                <SelectValue placeholder={placeholderText} />
              </SelectTrigger>
              <SelectContent>
                {filteredPlannings.map((planning) => (
                  <SelectItem key={planning.id} value={planning.id.toString()}>
                    v{planning.version} - {planning.month}/{planning.year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
          <Handle type="source" position={Position.Right} className="!bg-purple-500" />
        </Card>
      );
    });

    export default PlanningNode;