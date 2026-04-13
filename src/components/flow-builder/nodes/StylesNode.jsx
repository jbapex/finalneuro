import React, { memo, useCallback } from 'react';
import { Handle, Position } from 'reactflow';
import { FlowNodeHeaderDelete } from '@/components/flow-builder/FlowNodeHeaderDelete';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Type } from 'lucide-react';

const STYLE_TAGS = ['clássico', 'formal', 'elegante', 'institucional', 'tecnológico', 'minimalista', 'criativo'];

const StylesNode = memo(({ data, id, selected }) => {
  const { onUpdateNodeData } = data;
  const attrs = data.visual_attributes ?? {};
  const style_tags = Array.isArray(attrs.style_tags) ? attrs.style_tags : [];
  const sobriety = attrs.sobriety ?? 50;
  const ultra_realistic = !!attrs.ultra_realistic;
  const blur_enabled = !!attrs.blur_enabled;
  const lateral_gradient_enabled = !!attrs.lateral_gradient_enabled;

  const toggleTag = (tag) => {
    if (!onUpdateNodeData) return;
    const next = style_tags.includes(tag) ? style_tags.filter((t) => t !== tag) : [...style_tags, tag];
    const va = { ...attrs, style_tags: next };
    onUpdateNodeData(id, { visual_attributes: va, output: { id, data: { visual_attributes: va } } });
  };

  const setSobriety = (v) => {
    const next = typeof v === 'number' ? v : v[0];
    const va = { ...attrs, sobriety: next };
    onUpdateNodeData(id, { visual_attributes: va, output: { id, data: { visual_attributes: va } } });
  };

  const setBool = (key, value) => {
    const va = { ...attrs, [key]: value };
    onUpdateNodeData(id, { visual_attributes: va, output: { id, data: { visual_attributes: va } } });
  };

  return (
    <Card className="w-64 border-2 border-emerald-500/50 shadow-lg">
      <CardHeader className="flex flex-row items-center gap-2 p-3 bg-emerald-500/10 min-w-0">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Type className="w-5 h-5 shrink-0 text-emerald-500" />
          <CardTitle className="text-base truncate">Estilos</CardTitle>
        </div>
        <FlowNodeHeaderDelete nodeId={id} onRemoveNode={data.onRemoveNode} selected={selected} />
      </CardHeader>
      <CardContent className="p-3 space-y-3">
        <div className="space-y-1">
          <Label className="text-xs">Tags de estilo</Label>
          <div className="flex flex-wrap gap-1">
            {STYLE_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`px-2 py-0.5 rounded text-xs border transition-colors ${style_tags.includes(tag) ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-muted border-border hover:bg-muted/80'}`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Sobriedade ({sobriety}%)</Label>
          <Slider value={[sobriety]} onValueChange={setSobriety} min={0} max={100} step={5} className="w-full" />
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Ultra realista</Label>
            <Switch checked={ultra_realistic} onCheckedChange={(v) => setBool('ultra_realistic', v)} />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Blur de fundo</Label>
            <Switch checked={blur_enabled} onCheckedChange={(v) => setBool('blur_enabled', v)} />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Degradê lateral</Label>
            <Switch checked={lateral_gradient_enabled} onCheckedChange={(v) => setBool('lateral_gradient_enabled', v)} />
          </div>
        </div>
      </CardContent>
      <Handle type="source" position={Position.Right} className="!bg-emerald-500" />
    </Card>
  );
});

export default StylesNode;
