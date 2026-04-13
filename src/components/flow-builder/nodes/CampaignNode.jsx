import React, { memo, useMemo } from 'react';
import { Handle, Position } from 'reactflow';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Target } from 'lucide-react';
import { FlowNodeHeaderDelete } from '@/components/flow-builder/FlowNodeHeaderDelete';

const CampaignNode = memo(({ data, id, selected }) => {
  const { onUpdateNodeData, campaigns, inputData, selectedCampaignId } = data;
  
  const clientId = inputData?.client?.id;

  const filteredCampaigns = useMemo(() => {
    if (!campaigns) return [];
    
    if (clientId) {
      return campaigns.filter(campaign => campaign.client_id?.toString() === clientId.toString());
    }
    
    return campaigns;
  }, [clientId, campaigns]);

  const handleCampaignChange = (campaignId) => {
    const selectedCampaignData = campaigns.find(c => c.id.toString() === campaignId);
    onUpdateNodeData(id, { 
      selectedCampaignId: campaignId,
      output: { 
        id: campaignId,
        data: selectedCampaignData 
      }
    });
  };

  const isDisabled = !inputData?.client;
  
  const placeholderText = useMemo(() => {
    if (isDisabled) {
        return "Conecte um cliente";
    }
    if (filteredCampaigns.length === 0) {
        return "Nenhuma campanha encontrada";
    }
    return "Selecione uma campanha...";
  }, [isDisabled, filteredCampaigns.length]);

  return (
    <Card className="w-64 border-2 border-blue-500/50 shadow-lg">
      <Handle type="target" position={Position.Left} className="!bg-blue-500" />
      <CardHeader className="flex flex-row items-center gap-2 p-3 bg-blue-500/10 min-w-0">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Target className="w-5 h-5 shrink-0 text-blue-500" />
          <CardTitle className="text-base truncate">Campanha</CardTitle>
        </div>
        <FlowNodeHeaderDelete nodeId={id} onRemoveNode={data.onRemoveNode} selected={selected} />
      </CardHeader>
      <CardContent className="p-3">
        <Select onValueChange={handleCampaignChange} value={selectedCampaignId} disabled={isDisabled || filteredCampaigns.length === 0}>
          <SelectTrigger>
            <SelectValue placeholder={placeholderText} />
          </SelectTrigger>
          <SelectContent>
            {filteredCampaigns.map((campaign) => (
              <SelectItem key={campaign.id} value={campaign.id.toString()}>
                {campaign.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
      <Handle type="source" position={Position.Right} className="!bg-blue-500" />
    </Card>
  );
});

export default CampaignNode;