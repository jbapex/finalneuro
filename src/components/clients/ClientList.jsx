import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Edit, Trash2, Calendar } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { motion } from 'framer-motion';

const ClientList = ({ clients, onEdit, onDelete, onSelect }) => {
  const navigate = useNavigate();

  const handleCardClick = (client) => {
    onSelect(client);
  };

  const handleCalendarClick = (e, clientId) => {
    e.stopPropagation();
    navigate(`/ferramentas/calendario-de-publicacao/${clientId}`);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {clients.map((client, index) => (
        <motion.div
          key={client.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          className="h-full"
        >
          <Card 
            className="h-full flex flex-col justify-between cursor-pointer hover:shadow-lg transition-shadow duration-300"
            onClick={() => handleCardClick(client)}
          >
            <CardHeader>
              <CardTitle>{client.name}</CardTitle>
              <CardDescription className="line-clamp-2 h-10">{client.about || 'Sem descrição.'}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow" />
            <CardFooter className="flex justify-end gap-2 p-4 pt-0">
                <Button variant="ghost" size="icon" onClick={(e) => handleCalendarClick(e, client.id)} title="Calendário de Publicações">
                  <Calendar className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onEdit(client); }} title="Editar Cliente">
                  <Edit className="h-4 w-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={(e) => e.stopPropagation()} title="Excluir Cliente">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação não pode ser desfeita. Isso irá deletar permanentemente o cliente e todas as campanhas associadas a ele.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => onDelete(client.id)} className="bg-destructive hover:bg-destructive/90">
                        Deletar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
            </CardFooter>
          </Card>
        </motion.div>
      ))}
       <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: clients.length * 0.1 }}
        className="h-full"
      >
        <Card className="h-full flex flex-col items-center justify-center border-2 border-dashed bg-muted/50 hover:border-primary transition-colors">
          <CardHeader>
            <CardTitle className="text-center">Adicionar Novo Cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="ghost" className="h-24 w-24 rounded-full" onClick={() => onEdit(null)}>
              <PlusCircle className="h-12 w-12 text-muted-foreground" />
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default ClientList;