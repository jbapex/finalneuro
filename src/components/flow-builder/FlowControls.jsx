import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Loader2, Save, Plus, ArrowLeft, Trash2, ChevronDown, ListTree } from 'lucide-react';

const FlowControls = ({
    onSave,
    onNew,
    onDelete,
    flows,
    onFlowSelect,
    activeFlow,
    isReferenceLoading,
    isLoadingFlow,
    isSaving,
}) => {
    const navigate = useNavigate();
    return (
        <div className="w-full bg-card p-2 shadow-md border-b flex items-center gap-2">
            <Button onClick={() => navigate('/meus-fluxos')} size="icon" variant="outline" title="Voltar para Meus Fluxos">
                <ArrowLeft className="h-4 w-4" />
            </Button>
            
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-[250px] justify-between" disabled={isLoadingFlow}>
                        <span className="truncate flex items-center gap-2 min-w-0">
                            {isLoadingFlow && <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />}
                            {activeFlow ? activeFlow.name : "Selecione um fluxo"}
                        </span>
                        <ChevronDown className="h-4 w-4 opacity-50 flex-shrink-0" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[250px]">
                    {flows.map(flow => (
                        <DropdownMenuItem key={flow.id} onSelect={() => onFlowSelect(flow.id)}>
                            {flow.name}
                        </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => navigate('/meus-fluxos')}>
                        <ListTree className="mr-2 h-4 w-4" />
                        Gerenciar todos os fluxos
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <Button onClick={onNew} size="icon" variant="outline" disabled={isLoadingFlow} title="Novo Fluxo">
                <Plus className="h-4 w-4" />
            </Button>
            <Button onClick={onSave} size="icon" variant="outline" disabled={isReferenceLoading || isSaving || isLoadingFlow} title="Salvar Fluxo">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            </Button>
            <Button onClick={onDelete} size="icon" variant="destructive" disabled={!activeFlow || isReferenceLoading || isSaving || isLoadingFlow} title="Excluir Fluxo">
                <Trash2 className="h-4 w-4" />
            </Button>
        </div>
    );
};

export default FlowControls;