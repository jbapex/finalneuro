import React, { useMemo, forwardRef } from 'react';
import ReactFlow, { Background, Controls, MiniMap } from 'reactflow';
import 'reactflow/dist/style.css';

import ClientNode from '@/components/flow-builder/nodes/ClientNode';
import ContextNode from '@/components/flow-builder/nodes/ContextNode';
import CampaignNode from '@/components/flow-builder/nodes/CampaignNode';
import AgentNode from '@/components/flow-builder/nodes/AgentNode';
import ChatNode from '@/components/flow-builder/nodes/ChatNode';
import PlanningNode from '@/components/flow-builder/nodes/PlanningNode';
import AnalysisNode from '@/components/flow-builder/nodes/AnalysisNode';
import ImageGeneratorNode from '@/components/flow-builder/nodes/ImageGeneratorNode';
import VideoTranscriberNode from '@/components/flow-builder/nodes/VideoTranscriberNode';
import PageAnalyzerNode from '@/components/flow-builder/nodes/PageAnalyzerNode';
import SiteCreatorNode from '@/components/flow-builder/nodes/SiteCreatorNode';
import SiteStructureNode from '@/components/flow-builder/nodes/SiteStructureNode';
import SitePreviewNode from '@/components/flow-builder/nodes/SitePreviewNode';
import KnowledgeNode from '@/components/flow-builder/nodes/KnowledgeNode';
import GeneratedImageNode from '@/components/flow-builder/nodes/GeneratedImageNode';
import GeneratedContentNode from '@/components/flow-builder/nodes/GeneratedContentNode';
import CarouselNode from '@/components/flow-builder/nodes/CarouselNode';
import ReferenceImageNode from '@/components/flow-builder/nodes/ReferenceImageNode';
import ImageLogoNode from '@/components/flow-builder/nodes/ImageLogoNode';
import ColorsNode from '@/components/flow-builder/nodes/ColorsNode';
import StylesNode from '@/components/flow-builder/nodes/StylesNode';
import SubjectNode from '@/components/flow-builder/nodes/SubjectNode';
import CustomEdge from '@/components/flow-builder/edges/CustomEdge';

const withFlowNodeApi = (data, updateNodeData, removeNode, extra = {}) => ({
  ...data,
  onUpdateNodeData: updateNodeData,
  onRemoveNode: removeNode,
  ...extra,
});

const FlowCanvas = forwardRef(function FlowCanvas(
  {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    updateNodeData,
    removeNode,
    onAddImageOutputNode,
    onAddAgentOutputNode,
    onAddSitePreviewNode,
    onAddSiteStructureNode,
    onAddCarouselSlideImageNode,
    getFreshInputData,
    onRefreshData,
  },
  ref
) {
  const nodeTypes = useMemo(
    () => ({
      client: (props) => <ClientNode {...props} data={withFlowNodeApi(props.data, updateNodeData, removeNode)} />,
      context: (props) => <ContextNode {...props} data={withFlowNodeApi(props.data, updateNodeData, removeNode)} />,
      campaign: (props) => <CampaignNode {...props} data={withFlowNodeApi(props.data, updateNodeData, removeNode)} />,
      agent: (props) => (
        <AgentNode {...props} data={withFlowNodeApi(props.data, updateNodeData, removeNode, { onAddAgentOutputNode })} />
      ),
      chat: (props) => (
        <ChatNode {...props} data={withFlowNodeApi(props.data, updateNodeData, removeNode, { onRefreshData })} />
      ),
      planning: (props) => <PlanningNode {...props} data={withFlowNodeApi(props.data, updateNodeData, removeNode)} />,
      analysis: (props) => <AnalysisNode {...props} data={withFlowNodeApi(props.data, updateNodeData, removeNode)} />,
      image_generator: (props) => (
        <ImageGeneratorNode
          {...props}
          data={withFlowNodeApi(props.data, updateNodeData, removeNode, {
            onAddImageOutputNode,
            getFreshInputData,
          })}
        />
      ),
      generated_image: (props) => (
        <GeneratedImageNode {...props} data={withFlowNodeApi(props.data, updateNodeData, removeNode)} />
      ),
      generated_content: (props) => (
        <GeneratedContentNode {...props} data={withFlowNodeApi(props.data, updateNodeData, removeNode)} />
      ),
      carousel: (props) => (
        <CarouselNode
          {...props}
          data={withFlowNodeApi(props.data, updateNodeData, removeNode, {
            onAddCarouselSlideImageNode,
            getFreshInputData,
          })}
        />
      ),
      video_transcriber: (props) => (
        <VideoTranscriberNode {...props} data={withFlowNodeApi(props.data, updateNodeData, removeNode)} />
      ),
      page_analyzer: (props) => (
        <PageAnalyzerNode {...props} data={withFlowNodeApi(props.data, updateNodeData, removeNode)} />
      ),
      site_creator: (props) => (
        <SiteCreatorNode
          {...props}
          data={withFlowNodeApi(props.data, updateNodeData, removeNode, {
            onAddSiteStructureNode,
            onAddSitePreviewNode,
          })}
        />
      ),
      site_structure: (props) => (
        <SiteStructureNode
          {...props}
          data={withFlowNodeApi(props.data, updateNodeData, removeNode, { onAddSitePreviewNode })}
        />
      ),
      site_preview: (props) => <SitePreviewNode {...props} data={withFlowNodeApi(props.data, updateNodeData, removeNode)} />,
      knowledge: (props) => <KnowledgeNode {...props} data={withFlowNodeApi(props.data, updateNodeData, removeNode)} />,
      reference_image: (props) => (
        <ReferenceImageNode {...props} data={withFlowNodeApi(props.data, updateNodeData, removeNode)} />
      ),
      image_logo: (props) => <ImageLogoNode {...props} data={withFlowNodeApi(props.data, updateNodeData, removeNode)} />,
      colors: (props) => <ColorsNode {...props} data={withFlowNodeApi(props.data, updateNodeData, removeNode)} />,
      styles: (props) => <StylesNode {...props} data={withFlowNodeApi(props.data, updateNodeData, removeNode)} />,
      subject: (props) => <SubjectNode {...props} data={withFlowNodeApi(props.data, updateNodeData, removeNode)} />,
    }),
    [
      updateNodeData,
      removeNode,
      onAddImageOutputNode,
      onAddAgentOutputNode,
      onAddSitePreviewNode,
      onAddSiteStructureNode,
      onAddCarouselSlideImageNode,
      getFreshInputData,
      onRefreshData,
    ]
  );

  const edgeTypes = useMemo(
    () => ({
      custom: CustomEdge,
    }),
    []
  );

  const defaultEdgeOptions = {
    style: { strokeWidth: 2, stroke: '#8b5cf6' },
    animated: true,
    type: 'custom',
  };

  return (
    <div ref={ref} className="flex-grow h-full w-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        className="bg-background"
        proOptions={{ hideAttribution: true }}
      >
        <Controls position="bottom-right" />
        <MiniMap
          position="bottom-right"
          nodeStrokeWidth={3}
          zoomable
          pannable
          className="!bg-background border-2 border-border"
        />
        <Background variant="dots" gap={16} size={1} />
      </ReactFlow>
    </div>
  );
});

export default FlowCanvas;
