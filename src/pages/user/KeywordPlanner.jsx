import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Lightbulb, TrendingUp, ExternalLink, BarChart, Loader2, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/customSupabaseClient';
import { toast as sonnerToast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const KeywordTable = ({ title, data, queryKey, valueKey }) => (
    <Card>
        <CardHeader>
            <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Palavra-chave / Tópico</TableHead>
                        <TableHead className="text-right">Volume Relativo</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.map((item, index) => (
                        <TableRow key={index}>
                            <TableCell>
                                <a href={`https://trends.google.com${item.link}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-primary transition-colors">
                                    {item[queryKey]}
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                            </TableCell>
                            <TableCell className="text-right">
                                <Badge variant="secondary">{item[valueKey]}</Badge>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </CardContent>
    </Card>
);

const KeywordPlanner = () => {
    const [keyword, setKeyword] = useState('');
    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [geo, setGeo] = useState('BR');
    const [hl, setHl] = useState('pt-BR');

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!keyword.trim()) {
            sonnerToast.warning('Por favor, insira uma palavra-chave para pesquisar.');
            return;
        }
        setLoading(true);
        setError(null);
        setResults(null);

        try {
            const { data, error: functionError } = await supabase.functions.invoke('keyword-planner', {
                body: { keyword, geo, hl },
            });

            if (functionError) {
              const errorBody = functionError.context?.json ? await functionError.context.json() : { error: functionError.message };
              throw new Error(errorBody.error);
            }
            if (functionError) {
              const errorBody = functionError.context?.json ? await functionError.context.json() : { error: functionError.message };
              throw new Error(errorBody.error);
            }

            if (data?.error) {
              setResults(data.data || null);
              setError(data.error);
            } else {
              setResults(data);
            }

        } catch (err) {
            console.error(err);
            const errorMessage = err.message || "Ocorreu um erro desconhecido.";
            setError(errorMessage);
            sonnerToast.error("Erro ao buscar palavras-chave", { description: errorMessage });
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Helmet>
                <title>Planejador de Palavras-chave | Neuro Ápice</title>
                <meta name="description" content="Encontre palavras-chave relacionadas, perguntas populares e tópicos em ascensão para otimizar seu SEO e conteúdo." />
            </Helmet>
            <div className="container mx-auto p-4 md:p-6 lg:p-8">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="text-center mb-8"
                >
                    <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500">
                        Planejador de Palavras-chave
                    </h1>
                    <p className="text-lg text-muted-foreground mt-2 max-w-2xl mx-auto">
                        Descubra o que seu público está buscando e encontre novas oportunidades de conteúdo.
                    </p>
                </motion.div>

                <Card className="max-w-2xl mx-auto mb-8">
                    <CardContent className="p-6">
                        <form onSubmit={handleSearch} className="flex flex-col gap-4">
                            <div className="flex flex-col sm:flex-row gap-4">
                                <Input
                                    type="text"
                                    placeholder="Digite um tópico ou palavra-chave..."
                                    value={keyword}
                                    onChange={(e) => setKeyword(e.target.value)}
                                    className="flex-grow"
                                    disabled={loading}
                                />
                                <div className="flex gap-2 sm:w-auto w-full">
                                    <select
                                      className="flex-1 h-10 rounded-md border bg-background px-2 text-sm"
                                      value={geo}
                                      onChange={(e) => {
                                        const value = e.target.value;
                                        setGeo(value);
                                        setHl(value === 'US' ? 'en-US' : 'pt-BR');
                                      }}
                                      disabled={loading}
                                    >
                                      <option value="BR">Brasil (pt-BR)</option>
                                      <option value="US">Estados Unidos (en-US)</option>
                                    </select>
                                    <Button type="submit" disabled={loading} className="w-full sm:w-auto">
                                        {loading ? (
                                            <>
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                Pesquisando...
                                            </>
                                        ) : (
                                            <>
                                                <Search className="w-4 h-4 mr-2" />
                                                Pesquisar
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Dados em tempo real do Google Trends. Escolha o país para ver o que está em alta naquela região.
                            </p>
                        </form>
                    </CardContent>
                </Card>

                <AnimatePresence>
                    {loading && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex justify-center items-center flex-col gap-4 py-16"
                        >
                            <Loader2 className="w-12 h-12 text-primary animate-spin" />
                            <p className="text-muted-foreground">Buscando as melhores palavras-chave...</p>
                        </motion.div>
                    )}

                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="text-center text-red-500 bg-red-100 dark:bg-red-900/20 p-4 rounded-lg max-w-2xl mx-auto"
                        >
                            <div className="flex items-center justify-center gap-2">
                                <AlertTriangle className="w-5 h-5" />
                                <p className="font-semibold">Erro ao buscar dados</p>
                            </div>
                            <p className="text-sm mt-1">{error}</p>
                        </motion.div>
                    )}

                    {results && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                        >
                            <Tabs defaultValue="related" className="w-full">
                                <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 mb-6 max-w-2xl mx-auto">
                                    <TabsTrigger value="related"><Lightbulb className="w-4 h-4 mr-2" />Relacionadas</TabsTrigger>
                                    <TabsTrigger value="rising"><TrendingUp className="w-4 h-4 mr-2" />Em Ascensão</TabsTrigger>
                                    <TabsTrigger value="topics"><BarChart className="w-4 h-4 mr-2" />Tópicos</TabsTrigger>
                                </TabsList>
                                <TabsContent value="related">
                                    <KeywordTable title="Consultas Relacionadas" data={results.relatedQueries} queryKey="query" valueKey="formattedValue" />
                                </TabsContent>
                                <TabsContent value="rising">
                                    <KeywordTable title="Consultas em Ascensão" data={results.risingQueries} queryKey="query" valueKey="formattedValue" />
                                </TabsContent>
                                <TabsContent value="topics">
                                     <KeywordTable title="Tópicos Relacionados" data={results.relatedTopics} queryKey="topic_title" valueKey="formattedValue" />
                                </TabsContent>
                            </Tabs>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </>
    );
};

export default KeywordPlanner;