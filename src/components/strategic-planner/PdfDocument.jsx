import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';

const theme = {
  primary: '#2563EB',
  secondary: '#6B7280',
  background: '#FFFFFF',
  text: '#374151',
  textLight: '#6B7280',
  cardBg: '#F9FAFB',
  border: '#E5E7EB',
  tag: {
    video: '#DBEAFE',
    videoText: '#1E40AF',
    arte: '#E0E7FF',
    arteText: '#4338CA',
    ads: '#D1FAE5',
    adsText: '#065F46',
    evento: '#FEF3C7',
    eventoText: '#92400E',
  },
};

const styles = StyleSheet.create({
  page: { 
    paddingTop: 30, 
    paddingBottom: 50, // Space for footer
    paddingHorizontal: 40, 
    fontFamily: 'Helvetica', 
    backgroundColor: theme.background, 
    color: theme.text 
  },
  
  // Header and Footer
  header: { textAlign: 'center', marginBottom: 40 },
  mainTitle: { fontSize: 28, fontFamily: 'Helvetica-Bold', color: theme.primary, marginBottom: 8 },
  subtitle: { fontSize: 14, color: theme.textLight },
  
  footer: { 
    position: 'absolute', 
    bottom: 0, 
    left: 0, 
    right: 0, 
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 10,
    borderTopWidth: 1, 
    borderTopColor: theme.border, 
    fontSize: 8, 
    color: theme.textLight
  },
  
  // Section styles
  section: { marginBottom: 25, pageBreakBefore: 'auto' },
  sectionTitle: { 
    fontSize: 20, 
    fontFamily: 'Helvetica-Bold', 
    color: theme.text, 
    paddingBottom: 8, 
    borderBottomWidth: 2, 
    borderBottomColor: theme.primary, 
    marginBottom: 15 
  },
  
  // General text styles
  h1: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: theme.primary, marginBottom: 8 },
  h2: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: theme.text, marginBottom: 6 },
  text: { fontSize: 10, lineHeight: 1.5, color: theme.text },
  textMuted: { fontSize: 10, lineHeight: 1.5, color: theme.textLight },
  italic: { fontStyle: 'italic' },
  bold: { fontFamily: 'Helvetica-Bold' },
  
  // List styles
  listItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 5 },
  bullet: { marginRight: 5, fontSize: 10, lineHeight: 1.5, color: theme.primary },
  checkIcon: { marginRight: 5, fontSize: 10, lineHeight: 1.5 },
  
  // Card styles
  card: { backgroundColor: theme.cardBg, borderWidth: 1, borderColor: theme.border, borderRadius: 6, padding: 12, marginBottom: 10 },
  cardTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: theme.text },
  
  // Tag styles
  tagContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 5 },
  tag: { backgroundColor: '#E5E7EB', color: theme.text, padding: '3px 8px', borderRadius: 4, fontSize: 9 },

  // Table styles
  table: { display: "table", width: "auto", borderStyle: "solid", borderWidth: 1, borderColor: theme.border, borderRadius: 4, overflow: 'hidden' },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: theme.border, backgroundColor: theme.background },
  tableHeaderRow: { backgroundColor: theme.cardBg },
  tableColHeader: { width: "25%", padding: 8, fontFamily: 'Helvetica-Bold', fontSize: 9 },
  tableCol: { width: "25%", padding: 8 },
  tableCell: { fontSize: 9, color: theme.text },
});

// --- Visualizers for each section ---

const ObjectivePdf = ({ content }) => (
  <View>
    <View style={{ backgroundColor: theme.primary + '1A', padding: 12, borderRadius: 6, marginBottom: 12 }}>
      <Text style={[styles.h1, {color: theme.primary, textAlign: 'center'}]}>{content.objetivo_principal}</Text>
    </View>
    <Text style={[styles.h2, { marginTop: 10 }]}>Metas Secundárias:</Text>
    {content.metas_secundarias.map((meta, i) => (
      <View key={i} style={styles.listItem}>
        <Text style={styles.checkIcon}>✅</Text>
        <Text style={styles.text}>{meta}</Text>
      </View>
    ))}
  </View>
);

const WhatToDoPdf = ({ content }) => (
    <View>
        <Text style={styles.h2}>Frentes de Ação:</Text>
        {content.frente_de_acao.map((item, i) => (
            <View key={i} style={[styles.listItem, { marginBottom: 8 }]}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.text}>{item}</Text>
            </View>
        ))}
        {content.slogan_opcional && (
            <View style={{ backgroundColor: theme.cardBg, padding: 10, borderRadius: 6, marginTop: 15, borderLeftWidth: 3, borderLeftColor: theme.primary }}>
                <Text style={[styles.italic, styles.text]}>"{content.slogan_opcional}"</Text>
            </View>
        )}
    </View>
);

const PhasesPdf = ({ content }) => (
  <View>
    {content.fases.map((fase, i) => (
      <View key={i} style={styles.card} wrap={false}>
        <Text style={styles.cardTitle}>{fase.nome}</Text>
        <Text style={[styles.textMuted, { fontSize: 9, marginBottom: 5 }]}>{fase.periodo}</Text>
        <Text style={[styles.text, styles.italic, { marginBottom: 8 }]}>{fase.objetivo}</Text>
        <Text style={[styles.bold, styles.text, { fontSize: 10, marginBottom: 4 }]}>Ações:</Text>
        {fase.acoes.map((acao, j) => (
           <View key={j} style={styles.listItem}><Text style={styles.bullet}>-</Text><Text style={styles.text}>{acao}</Text></View>
        ))}
      </View>
    ))}
  </View>
);

const PaidTrafficPdf = ({ content }) => (
    <View>
        {content.campanhas.map((campanha, i) => (
            <View key={i} style={styles.card} wrap={false}>
                <Text style={styles.cardTitle}>{campanha.nome}</Text>
                <View style={styles.tagContainer}>
                    <Text style={styles.tag}>Orçamento: {campanha.orcamento}</Text>
                    <Text style={styles.tag}>Objetivo: {campanha.objetivo_ads}</Text>
                </View>
                <Text style={[styles.text, { marginTop: 8 }]}>Público: {campanha.publico}</Text>
                <Text style={[styles.bold, styles.text, { fontSize: 10, marginTop: 8, marginBottom: 4 }]}>Criativos:</Text>
                {campanha.criativos.map((criativo, j) => (
                    <View key={j} style={styles.listItem}><Text style={styles.bullet}>-</Text><Text style={styles.text}>{criativo}</Text></View>
                ))}
            </View>
        ))}
    </View>
);

const SchedulePdf = ({ content }) => (
    <View style={styles.table}>
        <View style={[styles.tableRow, styles.tableHeaderRow]}>
            <View style={styles.tableColHeader}><Text style={styles.tableCell}>Data</Text></View>
            <View style={styles.tableColHeader}><Text style={styles.tableCell}>Tipo</Text></View>
            <View style={styles.tableColHeader}><Text style={styles.tableCell}>Fase</Text></View>
            <View style={[styles.tableColHeader, {width: '50%'}]}><Text style={styles.tableCell}>Descrição</Text></View>
        </View>
        {content.itens.map((item, i) => (
            <View key={i} style={styles.tableRow} wrap={false}>
                <View style={styles.tableCol}><Text style={styles.tableCell}>{new Date(item.data + 'T00:00:00').toLocaleDateString('pt-BR')}</Text></View>
                <View style={styles.tableCol}>
                  <Text style={[styles.tag, {backgroundColor: theme.tag[item.tipo] || '#E5E7EB', color: theme.tag[item.tipo+'Text'] || theme.text }]}>
                    {item.tipo}
                  </Text>
                </View>
                <View style={styles.tableCol}><Text style={styles.tableCell}>{item.fase_ref}</Text></View>
                <View style={[styles.tableCol, {width: '50%'}]}><Text style={styles.tableCell}>{item.descricao}</Text></View>
            </View>
        ))}
    </View>
);

const VideoIdeasPdf = ({ content }) => (
    <View>
        {content.videos.map((video, i) => (
            <View key={i} style={styles.card} wrap={false}>
                <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8}}>
                    <Text style={styles.cardTitle}>{video.titulo}</Text>
                    <Text style={styles.tag}>Duração: {video.duracao}s</Text>
                </View>
                <View style={{ gap: 5 }}>
                    <Text style={styles.text}><Text style={styles.bold}>Gancho:</Text> {video.gancho}</Text>
                    <Text style={styles.text}><Text style={styles.bold}>Contexto:</Text> {video.contexto}</Text>
                    <Text style={styles.text}><Text style={styles.bold}>Clímax:</Text> {video.climax}</Text>
                    <Text style={styles.text}><Text style={styles.bold}>CTA:</Text> {video.cta}</Text>
                </View>
            </View>
        ))}
    </View>
);

const visualizers = {
    objective: ObjectivePdf,
    what_to_do: WhatToDoPdf,
    phases: PhasesPdf,
    paid_traffic: PaidTrafficPdf,
    schedule: SchedulePdf,
    video_ideas: VideoIdeasPdf,
};

const PdfSection = ({ title, content, stepKey }) => {
  if (!content) return null;
  const Visualizer = visualizers[stepKey];
  return (
    <View style={styles.section} wrap={true}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {Visualizer ? <Visualizer content={content} /> : <Text style={styles.text}>{JSON.stringify(content, null, 2)}</Text>}
    </View>
  );
};


const PdfDocument = ({ planningData }) => {
  const { planningSteps, clientName, campaignName, scopeLabel, month, year } = planningData;
  const scope = scopeLabel || campaignName || 'Contexto';
  const monthName = new Date(year, month - 1).toLocaleString('pt-BR', { month: 'long' });
  const generationDate = new Date().toLocaleString('pt-BR');

  return (
    <Document author="Cérebro Ápice" title={`Planejamento - ${scope}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header} fixed>
          <Text style={styles.mainTitle}>Plano Estratégico de Campanha</Text>
          <Text style={styles.subtitle}>{`${clientName} — ${scope}`}</Text>
          <Text style={styles.subtitle}>{`${monthName.charAt(0).toUpperCase() + monthName.slice(1)} de ${year}`}</Text>
        </View>

        <PdfSection title="1. Objetivo" content={planningSteps.objective?.content} stepKey="objective" />
        <PdfSection title="2. O que Vamos Fazer" content={planningSteps.what_to_do?.content} stepKey="what_to_do" />
        <PdfSection title="3. Fases da Campanha" content={planningSteps.phases?.content} stepKey="phases" />
        <PdfSection title="4. Tráfego Pago" content={planningSteps.paid_traffic?.content} stepKey="paid_traffic" />
        <PdfSection title="5. Cronograma de Postagens" content={planningSteps.schedule?.content} stepKey="schedule" />
        <PdfSection title="6. Ideias de Vídeo" content={planningSteps.video_ideas?.content} stepKey="video_ideas" />
        
        <View style={styles.footer} fixed>
          <Text>Gerado por Cérebro Ápice em {generationDate}</Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
};

export default PdfDocument;