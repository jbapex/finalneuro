import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { uploadNeuroDesignFile } from '@/lib/neurodesignStorage';
import { neuroDesignDefaultConfig } from '@/lib/neurodesign/defaultConfig';
import { Checkbox } from '@/components/ui/checkbox';
import { Upload, X, Plus, User, Music } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';

const DIMENSIONS = [
  { value: '1:1', label: '1:1 Feed' },
  { value: '4:5', label: '4:5 Feed' },
  { value: '9:16', label: '9:16 Stories' },
  { value: '16:9', label: '16:9 Horizontal' },
];

const MAX_PREACHERS = 3;
const MAX_SINGERS = 3;

export function churchArtDefaultConfig() {
  const base = neuroDesignDefaultConfig();
  return {
    ...base,
    text_enabled: true,
    text_mode: 'free',
    headline_h1: '',
    headline_subtheme: '',
    subheadline_h2: '',
    custom_text: '',
    subject_enabled: true,
    subject_description: '',
    subject_name: '',
    subject_image_urls: [],
    multi_preachers_enabled: false,
    preachers: [],
    singers: [],
    singers_with_photos_enabled: false,
    event_date: '',
    event_time: '',
    footer_pastor_presidente: '',
    footer_igreja_nome: '',
    footer_igreja_local: '',
    footer_pastor_local: '',
    dimensions: '1:1',
    image_size: '1K',
  };
}

const ChurchArtBuilderPanel = ({
  project,
  config,
  setConfig,
  imageConnections,
  onGenerate,
  isGenerating,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const defaultCfg = churchArtDefaultConfig();
  const [localConfig, setLocalConfig] = useState(() => config || defaultCfg);
  const [logosByProvider, setLogosByProvider] = useState({});

  React.useEffect(() => {
    setLocalConfig(config || defaultCfg);
  }, [config]);

  React.useEffect(() => {
    let cancelled = false;
    const loadLogos = async () => {
      try {
        const { data, error } = await supabase.from('llm_logos').select('provider, logo_url');
        if (!error && data && !cancelled) {
          const map = {};
          data.forEach((row) => {
            if (row?.provider && row?.logo_url) map[row.provider] = row.logo_url;
          });
          setLogosByProvider(map);
        }
      } catch {
        // falha silenciosa
      }
    };
    loadLogos();
    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback((key, value) => {
    const next = { ...localConfig, [key]: value };
    setLocalConfig(next);
    setConfig?.(next);
  }, [localConfig, setConfig]);

  const handleUploadSubject = useCallback(
    async (e) => {
      if (!project?.id || !user) {
        toast({ title: 'Selecione um projeto e faça login.', variant: 'destructive' });
        return;
      }
      const files = e.target?.files;
      if (!files?.length) return;
      try {
        const url = await uploadNeuroDesignFile(user.id, project.id, 'subject', files[0]);
        const urls = [...(localConfig.subject_image_urls || []), url];
        update('subject_image_urls', urls);
        toast({ title: 'Foto do pregador enviada.' });
      } catch (err) {
        toast({ title: 'Erro no upload', description: err?.message, variant: 'destructive' });
      }
    },
    [project, user, localConfig.subject_image_urls, update, toast]
  );

  const removeSubjectImage = useCallback(
    (index) => {
      const urls = [...(localConfig.subject_image_urls || [])];
      urls.splice(index, 1);
      update('subject_image_urls', urls);
    },
    [localConfig.subject_image_urls, update]
  );

  const [isUploadingStyleRefs, setIsUploadingStyleRefs] = useState(false);

  const handleUploadLogo = useCallback(
    async (e) => {
      if (!project?.id || !user) {
        toast({ title: 'Selecione um projeto e faça login.', variant: 'destructive' });
        return;
      }
      const files = e.target?.files;
      if (!files?.length) return;
      try {
        const url = await uploadNeuroDesignFile(user.id, project.id, 'logo', files[0]);
        update('logo_url', url);
        toast({ title: 'Logo enviada.' });
      } catch (err) {
        toast({ title: 'Erro no upload', description: err?.message, variant: 'destructive' });
      }
    },
    [project, user, update, toast]
  );

  const handleUploadStyleRefs = useCallback(
    async (fileList) => {
      if (!project?.id || !user) {
        toast({ title: 'Selecione um projeto e faça login.', variant: 'destructive' });
        return;
      }
      const files = Array.from(fileList || []);
      if (files.length === 0) return;
      const urls = [...(localConfig.style_reference_urls || [])];
      const instructions = [...(localConfig.style_reference_instructions || [])];
      const prevLen = urls.length;
      setIsUploadingStyleRefs(true);
      try {
        for (const file of files) {
          try {
            const url = await uploadNeuroDesignFile(user.id, project.id, 'style_refs', file);
            urls.push(url);
            instructions.push('');
          } catch (err) {
            toast({ title: 'Erro no upload', description: err?.message, variant: 'destructive' });
          }
        }
        if (urls.length > prevLen) {
          setLocalConfig((c) => {
            const next = { ...c, style_reference_urls: urls, style_reference_instructions: instructions };
            setConfig?.(next);
            return next;
          });
          toast({ title: 'Referência de estilo adicionada', description: `${urls.length - prevLen} imagem(ns) enviada(s).` });
        }
      } finally {
        setIsUploadingStyleRefs(false);
      }
    },
    [project, user, localConfig, setConfig, toast]
  );

  const removeStyleRef = useCallback(
    (index) => {
      const urls = [...(localConfig.style_reference_urls || [])];
      const instructions = [...(localConfig.style_reference_instructions || [])];
      urls.splice(index, 1);
      instructions.splice(index, 1);
      setLocalConfig((c) => {
        const next = { ...c, style_reference_urls: urls, style_reference_instructions: instructions };
        setConfig?.(next);
        return next;
      });
    },
    [localConfig.style_reference_urls, localConfig.style_reference_instructions, setConfig]
  );

  const preachers = Array.isArray(localConfig.preachers) ? localConfig.preachers : [];
  const singers = Array.isArray(localConfig.singers) ? localConfig.singers : [];

  const setPreachers = useCallback(
    (next) => {
      setLocalConfig((c) => {
        const out = { ...c, preachers: next };
        setConfig?.(out);
        return out;
      });
    },
    [setConfig]
  );

  const setSingers = useCallback(
    (next) => {
      setLocalConfig((c) => {
        const out = { ...c, singers: next };
        setConfig?.(out);
        return out;
      });
    },
    [setConfig]
  );

  const addPreacher = useCallback(() => {
    if (preachers.length >= MAX_PREACHERS) return;
    setPreachers([...preachers, { name: '', description: '', image_urls: [] }]);
  }, [preachers, setPreachers]);

  const removePreacher = useCallback(
    (index) => {
      const next = preachers.filter((_, i) => i !== index);
      setPreachers(next);
    },
    [preachers, setPreachers]
  );

  const updatePreacher = useCallback(
    (index, field, value) => {
      const next = preachers.map((p, i) => (i === index ? { ...p, [field]: value } : p));
      setPreachers(next);
    },
    [preachers, setPreachers]
  );

  const handleUploadPreacherPhoto = useCallback(
    async (preacherIndex, e) => {
      if (!project?.id || !user) {
        toast({ title: 'Selecione um projeto e faça login.', variant: 'destructive' });
        return;
      }
      const files = e.target?.files;
      if (!files?.length) return;
      try {
        const url = await uploadNeuroDesignFile(user.id, project.id, 'subject', files[0]);
        const next = preachers.map((p, i) =>
          i === preacherIndex ? { ...p, image_urls: [url] } : p
        );
        setPreachers(next);
        toast({ title: 'Foto do preletor enviada.' });
      } catch (err) {
        toast({ title: 'Erro no upload', description: err?.message, variant: 'destructive' });
      }
    },
    [project, user, preachers, setPreachers, toast]
  );

  const removePreacherPhoto = useCallback(
    (preacherIndex) => {
      const next = preachers.map((p, i) => (i === preacherIndex ? { ...p, image_urls: [] } : p));
      setPreachers(next);
    },
    [preachers, setPreachers]
  );

  const addSinger = useCallback(() => {
    if (singers.length >= MAX_SINGERS) return;
    setSingers([...singers, { name: '', image_urls: [] }]);
  }, [singers, setSingers]);

  const removeSinger = useCallback(
    (index) => {
      const next = singers.filter((_, i) => i !== index);
      setSingers(next);
    },
    [singers, setSingers]
  );

  const updateSinger = useCallback(
    (index, field, value) => {
      const next = singers.map((s, i) => (i === index ? { ...s, [field]: value } : s));
      setSingers(next);
    },
    [singers, setSingers]
  );

  const handleUploadSingerPhoto = useCallback(
    async (singerIndex, e) => {
      if (!project?.id || !user) {
        toast({ title: 'Selecione um projeto e faça login.', variant: 'destructive' });
        return;
      }
      const files = e.target?.files;
      if (!files?.length) return;
      try {
        const url = await uploadNeuroDesignFile(user.id, project.id, 'subject', files[0]);
        const next = singers.map((s, i) =>
          i === singerIndex ? { ...s, image_urls: [url] } : s
        );
        setSingers(next);
        toast({ title: 'Foto do cantor enviada.' });
      } catch (err) {
        toast({ title: 'Erro no upload', description: err?.message, variant: 'destructive' });
      }
    },
    [project, user, singers, setSingers, toast]
  );

  const removeSingerPhoto = useCallback(
    (singerIndex) => {
      const next = singers.map((s, i) => (i === singerIndex ? { ...s, image_urls: [] } : s));
      setSingers(next);
    },
    [singers, setSingers]
  );

  if (!project) {
    return (
      <div className="p-6 text-muted-foreground text-sm">
        Selecione ou crie um projeto na barra lateral para configurar a arte de culto.
      </div>
    );
  }

  const sectionTitleClass = 'text-sm font-semibold text-foreground border-b border-border pb-2 mt-6 first:mt-0';

  return (
    <div className="p-4 space-y-6">
      {/* Conexão */}
      <section className="space-y-4">
        <h3 className={sectionTitleClass}>Conexão</h3>
        <div>
          <Label className="text-muted-foreground">Conexão de imagem</Label>
          <Select
            value={localConfig.user_ai_connection_id || 'none'}
            onValueChange={(v) => update('user_ai_connection_id', v === 'none' ? null : v)}
          >
            <SelectTrigger className="mt-1 h-10 rounded-full bg-gradient-to-r from-primary/45 to-primary/30 border border-primary/60 hover:from-primary/55 hover:to-primary/40 hover:border-primary/70 text-foreground font-medium shadow-md shadow-primary/15 hover:shadow-lg hover:shadow-primary/25 transition-all duration-200">
              <SelectValue placeholder="Selecione uma conexão" />
            </SelectTrigger>
            <SelectContent className="bg-popover text-popover-foreground border-border">
              <SelectItem value="none">Usar mock (sem conexão)</SelectItem>
              {(imageConnections || []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <div className="flex items-center gap-2">
                    {logosByProvider[c.provider] && (
                      <img
                        src={logosByProvider[c.provider]}
                        alt=""
                        className="h-4 w-4 rounded-sm object-contain"
                      />
                    )}
                    <span>{c.name}</span>
                    {c.provider && (
                      <span className="text-xs text-muted-foreground">({c.provider})</span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {imageConnections?.length === 0 && (
            <p className="text-xs text-amber-500 mt-1">
              Nenhuma conexão de imagem. <Link to="/settings/ai" className="underline">Configurações → Minha IA</Link>
            </p>
          )}
        </div>
      </section>

      {/* Tema principal */}
      <section className="space-y-4">
        <h3 className={sectionTitleClass}>Tema principal</h3>
        <div>
          <Label>Título em evidência na arte</Label>
          <Input
            placeholder="Ex.: Culto de Jovens, CULTO Evangelístico"
            value={localConfig.headline_h1 || ''}
            onChange={(e) => update('headline_h1', e.target.value)}
            className="mt-1 bg-muted border-border text-foreground"
          />
          <p className="text-xs text-muted-foreground mt-1">Título ou tema do culto que aparecerá em destaque na arte.</p>
        </div>
        <div>
          <Label>Sub-tema / direção (opcional)</Label>
          <Input
            placeholder="Ex.: Na direção da Orquestra Asafe"
            value={localConfig.headline_subtheme || ''}
            onChange={(e) => update('headline_subtheme', e.target.value)}
            className="mt-1 bg-muted border-border text-foreground"
          />
        </div>
      </section>

      {/* Data e horário */}
      <section className="space-y-4">
        <h3 className={sectionTitleClass}>Data e horário</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Data do culto</Label>
            <Input
              placeholder="Ex.: DOM. 08/03"
              value={localConfig.event_date || ''}
              onChange={(e) => update('event_date', e.target.value)}
              className="mt-1 bg-muted border-border text-foreground"
            />
          </div>
          <div>
            <Label>Horário</Label>
            <Input
              placeholder="Ex.: 19h"
              value={localConfig.event_time || ''}
              onChange={(e) => update('event_time', e.target.value)}
              className="mt-1 bg-muted border-border text-foreground"
            />
          </div>
        </div>
      </section>

      {/* Louvores */}
      <section className="space-y-4">
        <h3 className={sectionTitleClass}>Louvores</h3>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="use-singers-list"
            checked={singers.length > 0}
            onCheckedChange={(checked) => {
              if (checked) setSingers(singers.length ? singers : [{ name: '', image_urls: [] }]);
              else setSingers([]);
            }}
          />
          <Label htmlFor="use-singers-list" className="text-sm font-normal cursor-pointer">Usar lista de cantores (vários nomes)</Label>
        </div>
        {singers.length === 0 ? (
          <div>
            <Label>Nomes dos cantores / grupos</Label>
            <Input
              placeholder="Ex.: Joãozinho, Aninha, Trio Adonai, Vaso de Louvor"
              value={localConfig.subheadline_h2 || ''}
              onChange={(e) => update('subheadline_h2', e.target.value)}
              className="mt-1 bg-muted border-border text-foreground"
            />
            <p className="text-xs text-muted-foreground mt-1">Aparece na arte como Louvores: …</p>
          </div>
        ) : (
          <>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="singers-with-photos"
                checked={!!localConfig.singers_with_photos_enabled}
                onCheckedChange={(checked) => update('singers_with_photos_enabled', !!checked)}
              />
              <Label htmlFor="singers-with-photos" className="text-sm font-normal cursor-pointer">Incluir fotos dos cantores</Label>
            </div>
            <div className="space-y-3">
              {singers.map((singer, i) => (
                <div key={i} className="p-3 rounded-lg border border-border bg-muted/30 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-muted-foreground">Cantor / grupo {i + 1}</span>
                    <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => removeSinger(i)} aria-label="Remover cantor">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <Input
                    placeholder="Ex.: Unidas para adorar, Anderson & Daiane"
                    value={singer.name || ''}
                    onChange={(e) => updateSinger(i, 'name', e.target.value)}
                    className="bg-muted border-border text-foreground"
                  />
                  {localConfig.singers_with_photos_enabled && (
                    <div className="flex items-center gap-2 flex-wrap">
                      {(singer.image_urls || []).map((url, j) => (
                        <div key={j} className="relative w-14 h-14 rounded overflow-hidden bg-muted">
                          <img src={url} alt="" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeSingerPhoto(i)}
                            className="absolute top-0 right-0 z-10 flex items-center justify-center min-w-[24px] min-h-[24px] bg-foreground/80 hover:bg-foreground text-background rounded-bl text-xs"
                            aria-label="Remover foto"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                      {(!singer.image_urls || singer.image_urls.length === 0) && (
                        <label className="relative w-14 h-14 rounded border border-dashed border-border flex items-center justify-center cursor-pointer hover:bg-muted shrink-0">
                          <Music className="h-4 w-4 text-muted-foreground pointer-events-none" />
                          <input type="file" accept="image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={(e) => handleUploadSingerPhoto(i, e)} />
                        </label>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {singers.length < MAX_SINGERS && (
                <Button type="button" variant="outline" size="sm" onClick={addSinger} className="border-border">
                  <Plus className="h-4 w-4 mr-1" /> Adicionar cantor
                </Button>
              )}
              <p className="text-xs text-muted-foreground">Máximo {MAX_SINGERS} cantores.</p>
            </div>
          </>
        )}
      </section>

      {/* Rodapé fixo */}
      <section className="space-y-4">
        <h3 className={sectionTitleClass}>Rodapé fixo</h3>
        <p className="text-xs text-muted-foreground">Cada texto em um canto da arte; ao centro a logo e o nome da igreja.</p>
        <div className="space-y-2">
          <div>
            <Label className="text-xs text-muted-foreground">Pastor Presidente (esquerda)</Label>
            <Input
              placeholder="Ex.: Pastor Presidente: Eloir dos Santos"
              value={localConfig.footer_pastor_presidente || ''}
              onChange={(e) => update('footer_pastor_presidente', e.target.value)}
              className="mt-1 bg-muted border-border text-foreground"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Nome da igreja (centro)</Label>
            <Input
              placeholder="Ex.: ASSEMBLEIA DE DEUS"
              value={localConfig.footer_igreja_nome || ''}
              onChange={(e) => update('footer_igreja_nome', e.target.value)}
              className="mt-1 bg-muted border-border text-foreground"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Local da igreja (centro, abaixo do nome)</Label>
            <Input
              placeholder="Ex.: VILA SÃO PEDRO"
              value={localConfig.footer_igreja_local || ''}
              onChange={(e) => update('footer_igreja_local', e.target.value)}
              className="mt-1 bg-muted border-border text-foreground"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Pastor Local (direita)</Label>
            <Input
              placeholder="Ex.: Pastor Local: Otiniel Stresser"
              value={localConfig.footer_pastor_local || ''}
              onChange={(e) => update('footer_pastor_local', e.target.value)}
              className="mt-1 bg-muted border-border text-foreground"
            />
          </div>
        </div>
        <div className="pt-2">
          <Label className="text-xs text-muted-foreground">Logo da igreja (centro do rodapé)</Label>
          <div className="flex gap-2 flex-wrap items-center mt-2">
            {localConfig.logo_url ? (
              <div className="relative w-14 h-14 rounded overflow-hidden bg-muted shrink-0">
                <img src={localConfig.logo_url} alt="Logo" className="w-full h-full object-contain" />
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); update('logo_url', ''); }}
                  className="absolute top-0 right-0 z-10 flex items-center justify-center min-w-[28px] min-h-[28px] bg-foreground/80 hover:bg-foreground text-background rounded-bl"
                  aria-label="Remover logo"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : null}
            <label className="relative w-14 h-14 rounded border border-dashed border-border flex items-center justify-center cursor-pointer hover:bg-muted shrink-0">
              <Upload className="h-4 w-4 text-muted-foreground pointer-events-none" />
              <input type="file" accept="image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handleUploadLogo} />
            </label>
          </div>
        </div>
      </section>

      {/* Pregador */}
      <section className="space-y-4">
        <h3 className={sectionTitleClass}>Pregador</h3>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="multi-preachers"
            checked={!!localConfig.multi_preachers_enabled}
            onCheckedChange={(checked) => update('multi_preachers_enabled', !!checked)}
          />
          <Label htmlFor="multi-preachers" className="text-sm font-normal cursor-pointer">Usar vários preletores</Label>
        </div>
        {!localConfig.multi_preachers_enabled ? (
          <>
            <div>
              <Label>Nome do pregador (para aparecer na arte)</Label>
              <Input
                placeholder="Ex.: Preletor: Coop. Gilmar"
                value={localConfig.subject_name || ''}
                onChange={(e) => update('subject_name', e.target.value)}
                className="mt-1 bg-muted border-border text-foreground"
              />
            </div>
            <div>
              <Label>Descrição para a IA (opcional)</Label>
              <Textarea
                placeholder="Ex.: Pastor João, terno escuro, fundo neutro"
                value={localConfig.subject_description || ''}
                onChange={(e) => update('subject_description', e.target.value)}
                className="mt-1 bg-muted border-border text-foreground min-h-[60px]"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Foto do pregador</Label>
              <div className="mt-2 flex flex-wrap gap-2 items-center">
                {(localConfig.subject_image_urls || []).map((url, i) => (
                  <div key={i} className="relative w-16 h-16 rounded overflow-hidden bg-muted">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeSubjectImage(i)}
                      className="absolute top-0 right-0 z-10 flex items-center justify-center min-w-[28px] min-h-[28px] bg-foreground/80 hover:bg-foreground text-background rounded-bl"
                      aria-label="Remover foto"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <label className="relative w-16 h-16 rounded border border-dashed border-border flex items-center justify-center cursor-pointer hover:bg-muted">
                  <Upload className="h-5 w-5 text-muted-foreground pointer-events-none" />
                  <input type="file" accept="image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handleUploadSubject} />
                </label>
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            {preachers.map((preacher, i) => (
              <div key={i} className="p-3 rounded-lg border border-border bg-muted/30 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Preletor {i + 1}</span>
                  <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => removePreacher(i)} aria-label="Remover preletor">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <Input
                  placeholder="Ex.: Pr. Neilson Silva, Andre Santana"
                  value={preacher.name || ''}
                  onChange={(e) => updatePreacher(i, 'name', e.target.value)}
                  className="bg-muted border-border text-foreground"
                />
                <Textarea
                  placeholder="Descrição para a IA (opcional)"
                  value={preacher.description || ''}
                  onChange={(e) => updatePreacher(i, 'description', e.target.value)}
                  className="bg-muted border-border text-foreground min-h-[50px] text-sm"
                  rows={2}
                />
                <div className="flex items-center gap-2 flex-wrap">
                  {(preacher.image_urls || []).map((url, j) => (
                    <div key={j} className="relative w-16 h-16 rounded overflow-hidden bg-muted">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removePreacherPhoto(i)}
                        className="absolute top-0 right-0 z-10 flex items-center justify-center min-w-[28px] min-h-[28px] bg-foreground/80 hover:bg-foreground text-background rounded-bl"
                        aria-label="Remover foto"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {(!preacher.image_urls || preacher.image_urls.length === 0) && (
                    <label className="relative w-16 h-16 rounded border border-dashed border-border flex items-center justify-center cursor-pointer hover:bg-muted shrink-0">
                      <User className="h-5 w-5 text-muted-foreground pointer-events-none" />
                      <input type="file" accept="image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={(e) => handleUploadPreacherPhoto(i, e)} />
                    </label>
                  )}
                </div>
              </div>
            ))}
            {preachers.length < MAX_PREACHERS && (
              <Button type="button" variant="outline" size="sm" onClick={addPreacher} className="border-border">
                <Plus className="h-4 w-4 mr-1" /> Adicionar preletor
              </Button>
            )}
            <p className="text-xs text-muted-foreground">Máximo {MAX_PREACHERS} preletores. Use 1 foto por preletor.</p>
          </div>
        )}
      </section>

      {/* Referências e extras */}
      <section className="space-y-4">
        <h3 className={sectionTitleClass}>Referências e extras</h3>
        <div>
          <Label>Referências de estilo</Label>
          <p className="text-xs text-muted-foreground mt-1">Envie imagens para a IA usar como referência visual (estilo, cores, composição).</p>
          <div className="flex gap-2 flex-wrap mt-2">
            {(localConfig.style_reference_urls || []).map((url, i) => (
              <div key={i} className="relative w-14 h-14 rounded overflow-hidden bg-muted shrink-0">
                <img src={url} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeStyleRef(i); }}
                  className="absolute top-0 right-0 z-10 flex items-center justify-center min-w-[28px] min-h-[28px] bg-foreground/80 hover:bg-foreground text-background rounded-bl"
                  aria-label="Remover referência de estilo"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            <label className="relative w-14 h-14 rounded border border-dashed border-border flex items-center justify-center cursor-pointer hover:bg-muted shrink-0 overflow-hidden">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                disabled={isUploadingStyleRefs}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={(e) => {
                  const files = e.target.files;
                  if (files?.length) handleUploadStyleRefs(files);
                  e.target.value = '';
                }}
              />
              {isUploadingStyleRefs ? <span className="text-xs">...</span> : <Upload className="h-4 w-4 pointer-events-none text-muted-foreground" />}
            </label>
          </div>
          {(localConfig.style_reference_urls || []).map((url, i) => (
            <div key={i} className="mt-3 p-2 rounded bg-muted/50 border border-border">
              <Label className="text-xs text-muted-foreground">Referência {i + 1} – O que copiar desta?</Label>
              <Input
                placeholder="Ex.: iluminação e paleta de cores, composição..."
                value={(localConfig.style_reference_instructions || [])[i] ?? ''}
                onChange={(e) => {
                  const arr = [...(localConfig.style_reference_instructions || [])];
                  while (arr.length <= i) arr.push('');
                  arr[i] = e.target.value;
                  update('style_reference_instructions', arr);
                }}
                className="mt-1 bg-muted border-border text-foreground text-sm"
              />
            </div>
          ))}
        </div>
        <div>
          <Label>Informação adicional</Label>
          <Textarea
            placeholder="Instruções extras para a IA (opcional)"
            value={localConfig.additional_prompt || ''}
            onChange={(e) => update('additional_prompt', e.target.value)}
            className="mt-1 bg-muted border-border text-foreground min-h-[80px]"
          />
        </div>
      </section>

      {/* Formato */}
      <section className="space-y-4">
        <h3 className={sectionTitleClass}>Formato</h3>
        <div>
          <Label>Dimensões</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {DIMENSIONS.map((d) => (
              <Button
                key={d.value}
                type="button"
                variant={localConfig.dimensions === d.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => update('dimensions', d.value)}
                className={localConfig.dimensions === d.value ? 'bg-primary' : 'border-border'}
              >
                {d.label}
              </Button>
            ))}
          </div>
        </div>
        <div>
          <Label>Qualidade da imagem</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {['1K', '2K', '4K'].map((q) => (
              <Button
                key={q}
                type="button"
                variant={localConfig.image_size === q ? 'default' : 'outline'}
                size="sm"
                onClick={() => update('image_size', q)}
                className={localConfig.image_size === q ? 'bg-primary' : 'border-border'}
              >
                {q === '1K' ? '1K (padrão)' : q}
              </Button>
            ))}
          </div>
        </div>
        <Button
          className="w-full"
          disabled={isGenerating}
          onClick={() => onGenerate?.(localConfig)}
        >
          {isGenerating ? 'Gerando…' : 'Gerar arte de culto'}
        </Button>
      </section>
    </div>
  );
};

export default ChurchArtBuilderPanel;
