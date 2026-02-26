import { useState, useEffect, useCallback, useRef } from 'react';
import { useNodesState, useEdgesState, addEdge, useReactFlow } from 'reactflow';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { v4 as uuidv4 } from 'uuid';

const initialNodes = [];
const initialEdges = [];

const getNodeDefaults = (type, position, data) => {
    const baseNode = {
        id: `${type}-${uuidv4()}`,
        type,
        position,
        data: { label: `${data.label}`, ...data },
    };
    return baseNode;
};

export const useFlowState = (flowData) => {
    const { clients, campaigns, modules, plannings, analyses, presets, knowledgeSources, fetchData: refreshFlowData } = flowData;
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const [flows, setFlows] = useState([]);
    const [activeFlow, setActiveFlow] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isNamePromptOpen, setIsNamePromptOpen] = useState(false);
    const [newFlowName, setNewFlowName] = useState('');
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

    const { setViewport, getViewport } = useReactFlow();
    const { flowId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { toast } = useToast();

    const nodesRef = useRef(nodes);
    const edgesRef = useRef(edges);
    nodesRef.current = nodes;
    edgesRef.current = edges;

    const fetchFlows = useCallback(async () => {
        if (!user) return;
        const { data, error } = await supabase
            .from('creative_flows')
            .select('id, name')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false });
        if (error) {
            toast({ title: 'Erro ao buscar fluxos', description: error.message, variant: 'destructive' });
        } else {
            setFlows(data);
        }
    }, [user, toast]);

    const loadFlow = useCallback(async (id) => {
        const { data, error } = await supabase
            .from('creative_flows')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            toast({ title: 'Erro ao carregar fluxo', description: error.message, variant: 'destructive' });
            navigate('/fluxo-criativo');
        } else {
            setActiveFlow(data);
            setNodes(data.nodes || []);
            setEdges(data.edges || []);
            if (data.viewport) {
                setViewport(data.viewport);
            }
        }
    }, [setNodes, setEdges, setViewport, toast, navigate]);

    useEffect(() => {
        fetchFlows();
    }, [fetchFlows]);

    useEffect(() => {
        if (flowId) {
            loadFlow(flowId);
        } else {
            setActiveFlow(null);
            setNodes([]);
            setEdges([]);
        }
    }, [flowId, loadFlow, setNodes, setEdges]);

    const getUpstreamNodesData = (nodeId, currentNodes, currentEdges) => {
        const context = {};
        const visited = new Set();
        const queue = [nodeId];
    
        while (queue.length > 0) {
            const currentId = queue.shift();
            if (visited.has(currentId)) continue;
            visited.add(currentId);
    
            const incomingEdges = currentEdges.filter(edge => edge.target === currentId);
            for (const edge of incomingEdges) {
                const sourceNode = currentNodes.find(n => n.id === edge.source);
                if (sourceNode) {
                    let entry = sourceNode.data.output;
                    if (!entry && sourceNode.type === 'subject') {
                        const d = sourceNode.data;
                        const hasSubject = d.subject_gender || (typeof d.subject_description === 'string' && d.subject_description.trim()) || (Array.isArray(d.subject_image_urls) && d.subject_image_urls.length > 0);
                        if (hasSubject) {
                            entry = {
                                id: sourceNode.id,
                                data: {
                                    subject_gender: d.subject_gender,
                                    subject_description: typeof d.subject_description === 'string' ? d.subject_description : '',
                                    subject_image_urls: Array.isArray(d.subject_image_urls) ? d.subject_image_urls : [],
                                },
                            };
                        }
                    }
                    if (!entry && (sourceNode.type === 'image_logo' || /^image_logo(_\d+)?$/.test(sourceNode.type))) {
                        const url = sourceNode.data?.logo_url;
                        if (typeof url === 'string' && url.trim()) {
                            entry = { id: sourceNode.id, data: { logo_url: url.trim() } };
                        }
                    }
                    if (entry) {
                        let key = sourceNode.type;
                        if (context[key]) {
                            let i = 2;
                            while (context[`${key}_${i}`]) {
                                i++;
                            }
                            key = `${key}_${i}`;
                        }
                        context[key] = entry;
                    }
                    if (!visited.has(sourceNode.id)) {
                        queue.push(sourceNode.id);
                    }
                }
            }
        }
        return context;
    };

    const getFreshInputData = useCallback((nodeId) => {
        return getUpstreamNodesData(nodeId, nodesRef.current, edgesRef.current);
    }, []);

    const onConnect = useCallback((params) => {
        setEdges((eds) => addEdge({ ...params, animated: true }, eds));
    }, [setEdges]);

    const updateNodeData = useCallback((nodeId, newData) => {
        setNodes((nds) =>
            nds.map((node) =>
                node.id === nodeId
                    ? { ...node, data: { ...node.data, ...newData } }
                    : node
            )
        );
    }, [setNodes]);

    const addNode = useCallback((type, label) => {
        const position = { x: Math.random() * 400, y: Math.random() * 400 };
        let nodeData = { label };

        switch (type) {
            case 'client':
                nodeData.clients = clients;
                break;
            case 'context':
                nodeData.clients = clients;
                break;
            case 'campaign':
                nodeData.campaigns = campaigns;
                break;
            case 'agent':
                nodeData.modules = modules;
                break;
            case 'planning':
                nodeData.plannings = plannings;
                break;
            case 'analysis':
                nodeData.analyses = analyses;
                break;
            case 'image_generator':
                nodeData.presets = presets;
                break;
            case 'knowledge':
                nodeData.knowledgeSources = knowledgeSources;
                break;
            case 'carousel':
                break;
            default:
                break;
        }

        const newNode = getNodeDefaults(type, position, nodeData);
        setNodes((nds) => nds.concat(newNode));
    }, [setNodes, clients, campaigns, modules, plannings, analyses, presets, knowledgeSources]);

    const addImageOutputNode = useCallback((sourceNodeId, imageUrl, imageData = {}) => {
        setNodes((nds) => {
            const source = nds.find((n) => n.id === sourceNodeId);
            if (!source) return nds;
            const position = { x: (source.position?.x ?? 0) + 320, y: source.position?.y ?? 0 };
            const newId = `generated_image-${uuidv4()}`;
            const newNode = getNodeDefaults('generated_image', position, { label: 'Imagem gerada', imageUrl, ...imageData });
            newNode.id = newId;
            newNode.data = { ...newNode.data, imageUrl, label: newNode.data.label || 'Imagem gerada' };
            queueMicrotask(() => {
                setEdges((eds) => addEdge({ source: sourceNodeId, target: newId, animated: true }, eds));
            });
            return nds.concat(newNode);
        });
    }, [setNodes, setEdges]);

    const addAgentOutputNode = useCallback((sourceNodeId, generatedText, outputData = {}) => {
        setNodes((nds) => {
            const source = nds.find((n) => n.id === sourceNodeId);
            if (!source) return nds;
            const position = { x: (source.position?.x ?? 0) + 320, y: source.position?.y ?? 0 };
            const newId = `generated_content-${uuidv4()}`;
            const label = outputData.moduleName ? `Conteúdo: ${outputData.moduleName}` : 'Conteúdo gerado';
            const newNode = getNodeDefaults('generated_content', position, { label, content: generatedText, generatedText, ...outputData });
            newNode.id = newId;
            newNode.data = {
                ...newNode.data,
                content: generatedText,
                generatedText,
                label: newNode.data.label || 'Conteúdo gerado',
                output: { id: newId, data: generatedText, moduleName: outputData.moduleName },
            };
            queueMicrotask(() => {
                setEdges((eds) => addEdge({ source: sourceNodeId, target: newId, animated: true }, eds));
            });
            return nds.concat(newNode);
        });
    }, [setNodes, setEdges]);

    const addCarouselSlideImageNode = useCallback((sourceNodeId, sourceHandleId, imageUrl, imageData = {}) => {
        setNodes((nds) => {
            const source = nds.find((n) => n.id === sourceNodeId);
            if (!source) return nds;
            const slideIndex = parseInt(String(sourceHandleId).replace('slide-', ''), 10) || 0;
            const position = { x: (source.position?.x ?? 0) + 320, y: (source.position?.y ?? 0) + slideIndex * 80 };
            const newId = `generated_image-${uuidv4()}`;
            const newNode = getNodeDefaults('generated_image', position, { label: 'Imagem gerada', imageUrl, ...imageData });
            newNode.id = newId;
            newNode.data = { ...newNode.data, imageUrl, label: newNode.data.label || 'Imagem gerada' };
            queueMicrotask(() => {
                setEdges((eds) => addEdge({ source: sourceNodeId, sourceHandle: sourceHandleId, target: newId, animated: true }, eds));
            });
            return nds.concat(newNode);
        });
    }, [setNodes, setEdges]);

    useEffect(() => {
        setNodes((nds) => {
            const newNodes = nds.map((node) => {
                const inputData = getUpstreamNodesData(node.id, nds, edges);
                let specificData = {};
                switch (node.type) {
                    case 'client':
                        specificData = { clients };
                        break;
                    case 'context':
                        specificData = { clients };
                        break;
                    case 'campaign':
                        specificData = { campaigns };
                        break;
                    case 'agent':
                        specificData = { modules, campaigns };
                        break;
                    case 'planning':
                        specificData = { plannings };
                        break;
                    case 'analysis':
                        specificData = { analyses };
                        break;
                    case 'image_generator':
                        specificData = { presets };
                        break;
                    case 'knowledge':
                        specificData = { knowledgeSources };
                        break;
                    default:
                        break;
                }
                return { ...node, data: { ...node.data, ...specificData, inputData } };
            });
            const inputDataUnchanged = newNodes.every(
                (n, i) => JSON.stringify(nds[i].data.inputData) === JSON.stringify(n.data.inputData)
            );
            if (inputDataUnchanged) return nds;
            return newNodes;
        });
    }, [clients, campaigns, modules, plannings, analyses, presets, knowledgeSources, edges, nodes, setNodes]);

    const handleSaveFlow = async (flowName) => {
        if (!user) return;
        if (activeFlow && !flowName) {
            setIsSaving(true);
            const { error } = await supabase
                .from('creative_flows')
                .update({
                    nodes,
                    edges,
                    viewport: getViewport(),
                })
                .eq('id', activeFlow.id);
            setIsSaving(false);
            if (error) {
                toast({ title: 'Erro ao salvar fluxo', description: error.message, variant: 'destructive' });
            } else {
                toast({ title: 'Fluxo salvo com sucesso!' });
                fetchFlows();
            }
        } else if (flowName) {
            setIsSaving(true);
            const { data, error } = await supabase
                .from('creative_flows')
                .insert({
                    user_id: user.id,
                    name: flowName,
                    nodes,
                    edges,
                    viewport: getViewport(),
                })
                .select()
                .single();
            setIsSaving(false);
            setIsNamePromptOpen(false);
            setNewFlowName('');
            if (error) {
                toast({ title: 'Erro ao criar fluxo', description: error.message, variant: 'destructive' });
            } else {
                toast({ title: 'Novo fluxo criado!' });
                fetchFlows();
                navigate(`/fluxo-criativo/${data.id}`);
            }
        } else {
            setIsNamePromptOpen(true);
        }
    };

    const handleNewFlow = () => {
        navigate('/fluxo-criativo');
        setActiveFlow(null);
        setNodes([]);
        setEdges([]);
    };


    const handleFlowSelect = (id) => {
        navigate(`/fluxo-criativo/${id}`);
    };

    const handleDeleteFlow = () => {
        if (activeFlow) {
            setIsDeleteConfirmOpen(true);
        }
    };

    const confirmDeleteFlow = async () => {
        if (!activeFlow) return;
        const { error } = await supabase
            .from('creative_flows')
            .delete()
            .eq('id', activeFlow.id);
        
        setIsDeleteConfirmOpen(false);
        if (error) {
            toast({ title: 'Erro ao excluir fluxo', description: error.message, variant: 'destructive' });
        } else {
            toast({ title: 'Fluxo excluído com sucesso!' });
            fetchFlows();
            handleNewFlow();
        }
    };

    return {
        nodes,
        edges,
        flows,
        activeFlow,
        isSaving,
        isNamePromptOpen,
        newFlowName,
        setNewFlowName,
        setIsNamePromptOpen,
        isDeleteConfirmOpen,
        setIsDeleteConfirmOpen,
        onNodesChange,
        onEdgesChange,
        onConnect,
        updateNodeData,
        addNode,
        addImageOutputNode,
        addAgentOutputNode,
        addCarouselSlideImageNode,
        getFreshInputData,
        handleSaveFlow,
        handleNewFlow,
        handleFlowSelect,
        handleDeleteFlow,
        confirmDeleteFlow,
        refreshFlowData,
    };
};