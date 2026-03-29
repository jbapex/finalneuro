import React, { useMemo } from 'react';
import NeuralNetworkCanvas from '@/components/ui/NeuralNetworkCanvas';
import {
  escapeHtmlForIframe,
  buildSiteHtmlDocument,
  buildInnerHtmlFromPageStructure,
} from '@/lib/siteBuilderDocument';

/** Script injetado no iframe: envia postMessage ao pai em cliques em elementos com data-id. */
const PREVIEW_CLICK_SCRIPT = `
(function(){
  function closestAnchor(el) {
    while (el && el !== document.body) {
      if (el.tagName === 'A' && el.hasAttribute('href')) return el;
      el = el.parentElement;
    }
    return null;
  }
  /** Links reais (#secao, https://…, mailto:, relativos) — não bloquear para validar navegação no iframe. */
  function linkShouldNavigate(a) {
    var href = (a.getAttribute('href') || '').trim();
    if (!href) return false;
    var h = href.toLowerCase();
    if (h === '#') return false;
    if (h.indexOf('javascript:') === 0) return false;
    return true;
  }
  function closestSectionId(el) {
    var n = el;
    while (n && n !== document.body) {
      if (n.getAttribute && n.getAttribute('data-section-id')) return n.getAttribute('data-section-id');
      n = n.parentElement;
    }
    return '';
  }
  function isVideoEmbedIframe(ifr) {
    var s = (ifr.getAttribute('src') || '').toLowerCase();
    if (!s) return false;
    if (s.indexOf('player.vimeo.com') >= 0) return true;
    if (s.indexOf('youtu.be/') >= 0) return true;
    if (s.indexOf('youtube.com/') >= 0 || s.indexOf('youtube-nocookie.com/') >= 0) return true;
    if (s.indexOf('vimeo.com/') >= 0 && /\\/\\d{5,}/.test(s)) return true;
    return false;
  }
  document.addEventListener('click', function(e) {
    var navA = closestAnchor(e.target);
    if (navA && linkShouldNavigate(navA)) {
      return;
    }
    // Vídeo / embed: clique no <video>, no iframe YouTube/Vimeo ou no wrapper data-type="video"
    var mediaEl = null;
    var t = e.target;
    while (t && t !== document.body) {
      if (t.tagName === 'VIDEO') { mediaEl = t; break; }
      if (t.tagName === 'IFRAME' && isVideoEmbedIframe(t)) { mediaEl = t; break; }
      t = t.parentElement;
    }
    if (!mediaEl) {
      var wrapV = e.target.closest('[data-type="video"]');
      if (wrapV) mediaEl = wrapV.querySelector('video, iframe');
    }
    if (mediaEl) {
      var dataId = mediaEl.getAttribute('data-id') || '';
      if (!dataId) {
        var w2 = mediaEl.closest('[data-type="video"][data-id]');
        if (w2) dataId = w2.getAttribute('data-id') || '';
      }
      if (!dataId) {
        var p = mediaEl.parentElement;
        while (p && p !== document.body) {
          if (p.getAttribute('data-id')) { dataId = p.getAttribute('data-id'); break; }
          p = p.parentElement;
        }
      }
      if (dataId) {
        var vsrc = '';
        var poster = '';
        if (mediaEl.tagName === 'VIDEO') {
          vsrc = mediaEl.currentSrc || mediaEl.src || '';
          if (!vsrc && mediaEl.querySelector('source')) vsrc = mediaEl.querySelector('source').getAttribute('src') || '';
          poster = mediaEl.getAttribute('poster') || '';
        } else {
          vsrc = mediaEl.getAttribute('src') || '';
        }
        window.parent.postMessage({
          type: 'site-preview-click',
          dataId: dataId,
          dataType: 'video',
          tagName: mediaEl.tagName,
          videoKind: mediaEl.tagName === 'VIDEO' ? 'video' : 'iframe',
          src: vsrc,
          poster: poster,
          sectionId: closestSectionId(mediaEl),
          textContent: ''
        }, '*');
        return;
      }
    }

    var el = e.target;
    // Se clicou em uma div que tem background-image
    if (el.tagName === 'DIV') {
      var style = window.getComputedStyle(el);
      if (style.backgroundImage && style.backgroundImage !== 'none') {
        var id = el.getAttribute('data-id');
        if (id) {
          var bgUrl = style.backgroundImage.replace(/^url\\(['"]?/, '').replace(/['"]?\\)$/, '');
          window.parent.postMessage({
            type: 'site-preview-click',
            dataId: id,
            dataType: 'image',
            tagName: el.tagName,
            textContent: '',
            src: bgUrl,
            isBackground: true
          }, '*');
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }
    }

    while (el && el !== document.body) {
      var id = el.getAttribute('data-id');
      if (id) {
        var type = (el.getAttribute('data-type') || '').toLowerCase();
        if (el.tagName === 'IMG') type = 'image';
        else if (!type) type = 'text';
        window.parent.postMessage({
          type: 'site-preview-click',
          dataId: id,
          dataType: type,
          tagName: el.tagName,
          textContent: el.textContent ? el.textContent.trim().slice(0, 2000) : '',
          src: el.src || ''
        }, '*');
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      el = el.parentElement;
    }
  });
})();
`;

const PreviewPanel = ({
  pageStructure,
  setPageStructure,
  htmlContent,
  setHtmlContent,
  selectedElement,
  setSelectedElement,
  onOpenImageBank,
  isBuilding,
  setIsBuilding,
}) => {
  const fullHtml = useMemo(() => {
    if (pageStructure && pageStructure.length > 0) {
      const inner = buildInnerHtmlFromPageStructure(pageStructure);
      if (!inner) return '';
      return buildSiteHtmlDocument({
        rootInnerHtml: inner,
        editorScript: PREVIEW_CLICK_SCRIPT,
      });
    }
    const safeContent = escapeHtmlForIframe(htmlContent || '');
    const hasContent = safeContent.trim().length > 0;
    const rootContent = hasContent ? safeContent : '';
    return buildSiteHtmlDocument({
      rootInnerHtml: rootContent,
      editorScript: PREVIEW_CLICK_SCRIPT,
    });
  }, [pageStructure, htmlContent]);

  const hasContent = useMemo(() => {
    if (pageStructure && pageStructure.length > 0) return true;
    if (htmlContent && htmlContent.trim().length > 0) return true;
    return false;
  }, [pageStructure, htmlContent]);

  return (
    <div className="relative flex-1 min-h-0 w-full min-w-0 h-full min-h-[400px] overflow-hidden">
      {isBuilding && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="relative w-full max-w-[250px] aspect-square flex items-center justify-center mb-4">
            <NeuralNetworkCanvas isActive={true} />
          </div>
          <p className="text-sm text-muted-foreground animate-pulse">Construindo sua página...</p>
        </div>
      )}
      {!isBuilding && !hasContent && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-muted/30">
          <div className="relative w-full max-w-[250px] aspect-square flex items-center justify-center mb-4">
            <NeuralNetworkCanvas isActive={false} />
          </div>
          <p className="text-sm text-muted-foreground">Nenhum conteúdo ainda. Use o chat para gerar seu site.</p>
        </div>
      )}
      <iframe
        srcDoc={fullHtml}
        title="Preview do site"
        className="w-full h-full min-h-[400px] border-0"
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
      />
    </div>
  );
};

export default PreviewPanel;
