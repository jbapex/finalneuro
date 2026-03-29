import React from 'react';
    import { NavLink, useParams } from 'react-router-dom';
    import { User, CreditCard, Bot } from 'lucide-react';
    import ProfileTab from './settings/ProfileTab';
    import BillingTab from './settings/BillingTab';
    import UserAiSettings from './settings/UserAiSettings';
    import { useAuth } from '@/contexts/SupabaseAuthContext';

    const SettingsPage = () => {
        const { tab } = useParams();
        const { hasPermission } = useAuth();
        
        const tabs = [
            { id: 'profile', label: 'Perfil', icon: User, component: <ProfileTab />, permission: true },
            { id: 'billing', label: 'Assinatura', icon: CreditCard, component: <BillingTab />, permission: true },
            { id: 'ai', label: 'Minha IA', icon: Bot, component: <UserAiSettings />, permission: hasPermission('custom_ai') },
        ].filter(t => t.permission);
        
        const activeTab = tabs.find(t => t.id === tab) || tabs[0];

        return (
            <div className="container mx-auto max-w-5xl py-8 px-4">
                <h1 className="text-3xl font-bold mb-8">Configurações</h1>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    <aside className="md:col-span-1">
                        <nav className="flex flex-col space-y-2">
                            {tabs.map(t => (
                                <NavLink
                                    key={t.id}
                                    to={`/settings/${t.id}`}
                                    className={({ isActive }) =>
                                        `flex items-center px-4 py-2 rounded-md text-sm font-medium ${
                                        isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                                        }`
                                    }
                                >
                                    <t.icon className="mr-3 h-5 w-5" />
                                    <span>{t.label}</span>
                                </NavLink>
                            ))}
                        </nav>
                    </aside>
                    <main className="md:col-span-3">
                        {activeTab.component}
                    </main>
                </div>
            </div>
        );
    };

    export default SettingsPage;