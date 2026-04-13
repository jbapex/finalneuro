import { useState, useEffect, useCallback, useRef } from 'react';
import { useNodesState, useEdgesState, addEdge, useReactFlow } from 'reactflow';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { v4 as uuidv4 } from 'uuid';

const initialNodes = [];
const initialEdges = [];

/** Grafo de upstream (puro) — usado para hidratar `inputData` nos nós. */
function getUpstreamNodesData(nodeId, currentNodes, currentEdges) {
    const context = {};
    const visited = new Set();
    const queue = [nodeId];

    while (queue.length > 0) {
        const currentId = queue.shift();
        if (visited.has(currentId)) continue;
        visited.add(currentId);

        const incomingEdges = currentEdges.filter((edge) => edge.target === currentId);
        for (const edge of incomingEdges) {
            const sourceNode = currentNodes.find((n) => n.id === edge.source);
            if (sourceNode) {
                let entry = sourceNode.data.output;
                if (!entry && sourceNode.type === 'subject') {
                    const d = sourceNode.data;
                    const hasSubject =
                        d.subject_gender ||
                        (typeof d.subject_description === 'string' && d.subject_description.trim()) ||
                        (Array.isArray(d.subject_image_urls) && d.subject_image_urls.length > 0);
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
}

function mergeReferenceAndInputData(nds, currentEdges, refCtx) {
    const { clients, campaigns, modules, plannings, analyses, presets, knowledgeSources } = refCtx;
    const newNodes = nds.map((node) => {
        const inputData = getUpstreamNodesData(node.id, nds, currentEdges);
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
}

const getNodeDefaults = (type, position, data) => {
    const baseNode = {
        id: `${type}-${uuidv4()}`,
        type,
        position,
        data: { label: `${data.label}`, ...data },
    };
    return baseNode;
};

/**
 * @param {import('react').RefObject<HTMLElement | null>} [flowPaneRef] — elemento que envolve o React Flow (para centrar novos nós na vista atual)
 */
export const useFlowState = (flowData, flowPaneRef) => {
    const { clients, campaigns, modules, plannings, analyses, presets, knowledgeSources, fetchData: refreshFlowData } = flowData;
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const [flows, setFlows] = useState([]);
    const [activeFlow, setActiveFlow] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isNamePromptOpen, setIsNamePromptOpen] = useState(false);
    const [newFlowName, setNewFlowName] = useState('');
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [isLoadingFlow, setIsLoadingFlow] = useState(false);

    const { setViewport, getViewport, screenToFlowPosition } = useReactFlow();
    const { flowId } = useParams();
    const navigate = useNavigate();
    const { user, profile } = useAuth();
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
        setIsLoadingFlow(true);
        try {
            const { data, error } = await supabase
                .from('creative_flows')
                .select('id, name, user_id, nodes, edges, viewport, updated_at')
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
        } finally {
            setIsLoadingFlow(false);
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

    const getFreshInputData = useCallback((nodeId) => {
        return getUpstreamNodesData(nodeId, nodesRef.current, edgesRef.current);
    }, []);

    const onConnect = useCallback((params) => {
        setEdges((eds) => addEdge({ ...params, animated: true }, eds));
    }, [setEdges]);

    const updateNodeData = useCallback((nodeId, newData) => {
        setNodes((nds) => {
            const next = nds.map((node) =>
                node.id === nodeId ? { ...node, data: { ...node.data, ...newData } } : node
            );
            return mergeReferenceAndInputData(next, edgesRef.current, {
                clients,
                campaigns,
                modules,
                plannings,
                analyses,
                presets,
                knowledgeSources,
            });
        });
    }, [setNodes, clients, campaigns, modules, plannings, analyses, presets, knowledgeSources]);

    const mergeCtx = {
        clients,
        campaigns,
        modules,
        plannings,
        analyses,
        presets,
        knowledgeSources,
    };

    /**
     * Remove vários nós e arestas ligadas num único update (várias chamadas a removeNode no mesmo tick quebrariam o ref).
     * Para cada nó, se a aresta entrante vier de carrossel (handle slide-N), limpa a lâmina como em removeNode.
     */
    const removeNodesBatch = useCallback(
        (nodeIds) => {
            const idSet = new Set((Array.isArray(nodeIds) ? nodeIds : []).filter(Boolean));
            if (idSet.size === 0) return;

            const currentEdges = edgesRef.current;
            const currentNodes = nodesRef.current;

            let nextNodes = currentNodes.map((n) => ({ ...n, data: { ...n.data } }));

            for (const nodeId of idSet) {
                const incoming = currentEdges.filter((e) => e.target === nodeId);
                for (const edge of incoming) {
                    const sourceNode = currentNodes.find((n) => n.id === edge.source);
                    if (!sourceNode || sourceNode.type !== 'carousel') continue;
                    const m = String(edge.sourceHandle || '').match(/^slide-(\d+)$/);
                    if (!m) continue;
                    const slideIdx = parseInt(m[1], 10);
                    const carouselState = nextNodes.find((n) => n.id === sourceNode.id);
                    const prevSlides = carouselState?.data?.slides;
                    if (!Array.isArray(prevSlides) || slideIdx < 0 || slideIdx >= prevSlides.length) continue;
                    const slides = prevSlides.map((s, i) => {
                        if (i !== slideIdx) return s;
                        const copy = { ...(s || {}) };
                        delete copy.imageUrl;
                        delete copy.runId;
                        delete copy.imageId;
                        delete copy.projectId;
                        return copy;
                    });
                    nextNodes = nextNodes.map((n) =>
                        n.id === sourceNode.id ? { ...n, data: { ...n.data, slides } } : n
                    );
                }
            }

            const nextEdges = currentEdges.filter((e) => !idSet.has(e.source) && !idSet.has(e.target));
            nextNodes = nextNodes.filter((n) => !idSet.has(n.id));

            setEdges(nextEdges);
            setNodes(mergeReferenceAndInputData(nextNodes, nextEdges, mergeCtx));
        },
        [setNodes, setEdges, clients, campaigns, modules, plannings, analyses, presets, knowledgeSources]
    );

    /** Remove um nó e arestas ligadas; se vier de um carrossel (handle slide-N), limpa a lâmina. */
    const removeNode = useCallback((nodeId) => removeNodesBatch([nodeId]), [removeNodesBatch]);

    const addNode = useCallback((type, label) => {
        let position = { x: Math.random() * 400, y: Math.random() * 400 };
        const pane = flowPaneRef?.current;
        if (pane && typeof screenToFlowPosition === 'function') {
            const r = pane.getBoundingClientRect();
            if (r.width > 0 && r.height > 0) {
                const center = screenToFlowPosition({
                    x: r.left + r.width / 2,
                    y: r.top + r.height / 2,
                });
                // Pequeno desvio para vários cliques não empilharem no mesmo pixel; aproxima o “centro” visual do nó
                position = {
                    x: center.x - 160 + (Math.random() - 0.5) * 56,
                    y: center.y - 120 + (Math.random() - 0.5) * 56,
                };
            }
        }
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
                nodeData.imageGeneratorConfigured = false;
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
    }, [
        setNodes,
        clients,
        campaigns,
        modules,
        plannings,
        analyses,
        presets,
        knowledgeSources,
        flowPaneRef,
        screenToFlowPosition,
    ]);

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

    const addSiteStructureNode = useCallback((sourceNodeId, payload = {}) => {
        const {
            projectName = '',
            structureText = '',
            siteCreatorNodeId,
            flowContextJson = '',
            llm_integration_id = null,
            llm_is_user_connection = false,
        } = payload;
        setNodes((nds) => {
            const source = nds.find((n) => n.id === sourceNodeId);
            if (!source) return nds;
            const position = { x: (source.position?.x ?? 0) + 340, y: source.position?.y ?? 0 };
            const newId = `site_structure-${uuidv4()}`;
            const safeName = typeof projectName === 'string' && projectName.trim() ? projectName.trim() : 'Site';
            const creatorId = siteCreatorNodeId || sourceNodeId;
            const newNode = getNodeDefaults('site_structure', position, {
                label: `Estrutura: ${safeName}`,
                projectName: safeName,
                structureText: typeof structureText === 'string' ? structureText : '',
                flowContextJson: typeof flowContextJson === 'string' ? flowContextJson : '',
                siteCreatorNodeId: creatorId,
                llm_integration_id,
                llm_is_user_connection: Boolean(llm_is_user_connection),
            });
            newNode.id = newId;
            queueMicrotask(() => {
                setEdges((eds) => addEdge({ source: sourceNodeId, target: newId, animated: true }, eds));
            });
            return nds.concat(newNode);
        });
    }, [setNodes, setEdges]);

    const addSitePreviewNode = useCallback((sourceNodeId, { projectId, projectName, siteCreatorNodeId } = {}) => {
        if (!projectId) return;
        setNodes((nds) => {
            if (nds.some((n) => n.type === 'site_preview' && String(n.data?.projectId) === String(projectId))) {
                return nds;
            }
            const source = nds.find((n) => n.id === sourceNodeId);
            if (!source) return nds;
            const position = { x: (source.position?.x ?? 0) + 340, y: source.position?.y ?? 0 };
            const newId = `site_preview-${uuidv4()}`;
            const safeName = typeof projectName === 'string' && projectName.trim() ? projectName.trim() : 'Site';
            const creatorRef = siteCreatorNodeId != null ? siteCreatorNodeId : sourceNodeId;
            const newNode = getNodeDefaults('site_preview', position, {
                label: `Preview: ${safeName}`,
                projectId,
                projectName: safeName,
                sourceSiteCreatorNodeId: creatorRef,
                siteCreatorNodeId: creatorRef,
            });
            newNode.id = newId;
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

    // Hidrata listas (clientes, módulos…) e `inputData` quando mudam dados de referência, arestas ou o fluxo ativo.
    // Importante: NÃO depender de `nodes` aqui — senão cada arraste no canvas reexecuta O(n²) e deixa a troca de fluxo lenta.
    useEffect(() => {
        if (flowId && (!activeFlow || String(activeFlow.id) !== String(flowId))) {
            return;
        }
        setNodes((nds) =>
            mergeReferenceAndInputData(nds, edges, {
                clients,
                campaigns,
                modules,
                plannings,
                analyses,
                presets,
                knowledgeSources,
            })
        );
    }, [
        clients,
        campaigns,
        modules,
        plannings,
        analyses,
        presets,
        knowledgeSources,
        edges,
        activeFlow?.id,
        flowId,
        setNodes,
    ]);

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
            const rawLimit =
                profile?.creative_flow_limit ??
                profile?.plans?.creative_flow_limit ??
                profile?.plan_image_generation_config?.creative_flow_limit ??
                profile?.plans?.plan_image_generation_config?.creative_flow_limit ??
                profile?.max_creative_flows ??
                profile?.plans?.max_creative_flows;
            const parsedLimit = Number(rawLimit);
            const creativeFlowLimit = profile?.user_type === 'super_admin'
                ? Number.POSITIVE_INFINITY
                : (Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.floor(parsedLimit) : 3);
            if (Number.isFinite(creativeFlowLimit) && flows.length >= creativeFlowLimit) {
                toast({
                    title: 'Limite de fluxos atingido',
                    description: `Seu plano permite até ${creativeFlowLimit} fluxos criativos. Exclua um fluxo ou solicite liberação de mais.`,
                    variant: 'destructive',
                });
                return;
            }
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
        removeNode,
        addNode,
        addImageOutputNode,
        addAgentOutputNode,
        addSiteStructureNode,
        addSitePreviewNode,
        addCarouselSlideImageNode,
        getFreshInputData,
        handleSaveFlow,
        handleNewFlow,
        handleFlowSelect,
        handleDeleteFlow,
        confirmDeleteFlow,
        refreshFlowData,
        isLoadingFlow,
    };
};