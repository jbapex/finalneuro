import React, { memo, useCallback } from 'react';
import { Handle, Position } from 'reactflow';
import { FlowNodeHeaderDelete } from '@/components/flow-builder/FlowNodeHeaderDelete';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Palette } from 'lucide-react';

const ColorsNode = memo(({ data, id, selected }) => {
  const { onUpdateNodeData } = data;
  const ambient = data.ambient_color ?? '';
  const rim = data.rim_light_color ?? '';
  const fill = data.fill_light_color ?? '';

  const update = useCallback(
    (key, value) => {
      if (!onUpdateNodeData) return;
      const next = { ambient_color: ambient, rim_light_color: rim, fill_light_color: fill, [key]: value };
      const hasAny = [next.ambient_color, next.rim_light_color, next.fill_light_color].some((v) => typeof v === 'string' && v.trim());
      onUpdateNodeData(id, {
        ambient_color: next.ambient_color,
        rim_light_color: next.rim_light_color,
        fill_light_color: next.fill_light_color,
        output: hasAny ? { id, data: { ambient_color: next.ambient_color?.trim() || '', rim_light_color: next.rim_light_color?.trim() || '', fill_light_color: next.fill_light_color?.trim() || '' } } : null,
      });
    },
    [id, onUpdateNodeData, ambient, rim, fill]
  );

  return (
    <Card className="w-64 border-2 border-rose-500/50 shadow-lg">
      <CardHeader className="flex flex-row items-center gap-2 p-3 bg-rose-500/10 min-w-0">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Palette className="w-5 h-5 shrink-0 text-rose-500" />
          <CardTitle className="text-base truncate">Cores</CardTitle>
        </div>
        <FlowNodeHeaderDelete nodeId={id} onRemoveNode={data.onRemoveNode} selected={selected} />
      </CardHeader>
      <CardContent className="p-3 space-y-2">
        <div className="space-y-1">
          <Label className="text-xs">Luz ambiente</Label>
          <div className="flex gap-2 items-center">
            <Input
              type="color"
              value={ambient || '#808080'}
              onChange={(e) => update('ambient_color', e.target.value)}
              className="h-8 w-12 p-1 cursor-pointer"
            />
            <Input
              value={ambient}
              onChange={(e) => update('ambient_color', e.target.value)}
              placeholder="#hex"
              className="h-8 flex-1 text-sm font-mono"
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Luz de recorte</Label>
          <div className="flex gap-2 items-center">
            <Input
              type="color"
              value={rim || '#808080'}
              onChange={(e) => update('rim_light_color', e.target.value)}
              className="h-8 w-12 p-1 cursor-pointer"
            />
            <Input
              value={rim}
              onChange={(e) => update('rim_light_color', e.target.value)}
              placeholder="#hex"
              className="h-8 flex-1 text-sm font-mono"
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Luz de preenchimento</Label>
          <div className="flex gap-2 items-center">
            <Input
              type="color"
              value={fill || '#808080'}
              onChange={(e) => update('fill_light_color', e.target.value)}
              className="h-8 w-12 p-1 cursor-pointer"
            />
            <Input
              value={fill}
              onChange={(e) => update('fill_light_color', e.target.value)}
              placeholder="#hex"
              className="h-8 flex-1 text-sm font-mono"
            />
          </div>
        </div>
      </CardContent>
      <Handle type="source" position={Position.Right} className="!bg-rose-500" />
    </Card>
  );
});

export default ColorsNode;
