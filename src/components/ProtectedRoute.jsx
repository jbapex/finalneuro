import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';

const ProtectedRoute = ({ children, allowedRoles, permissionKey }) => {
  const { user, profile, loading, hasPermission } = useAuth();
  const location = useLocation();
  const { toast } = useToast();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to={`/auth?next=${location.pathname}`} state={{ from: location }} replace />;
  }

  const userType = profile?.user_type;

  if (allowedRoles && !allowedRoles.includes(userType)) {
    if (userType === 'super_admin') {
      return <Navigate to="/superadmin/dashboard" replace />;
    }
    return <Navigate to="/ferramentas" replace />;
  }
  
  if (permissionKey && !hasPermission(permissionKey)) {
      toast({
        title: "Acesso Negado",
        description: "Você não tem permissão para acessar esta página. Considere fazer um upgrade.",
        variant: "destructive",
      });
      
      return <Navigate to="/ferramentas" replace />;
  }


  return children;
};

export default ProtectedRoute;