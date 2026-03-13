import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
	return twMerge(clsx(inputs));
}

/**
 * Traduz mensagens de erro técnicas (como timeouts e erros de Edge Functions)
 * para mensagens amigáveis para o usuário final.
 * @param {Error|string} error - O objeto de erro ou a mensagem de erro original
 * @returns {string} A mensagem de erro amigável
 */
export function getFriendlyErrorMessage(error) {
  const msg = typeof error === 'string' ? error : (error?.message || '');
  const lowerMsg = msg.toLowerCase();

  if (lowerMsg.includes('non-2xx status code') || lowerMsg.includes('504') || lowerMsg.includes('timeout') || lowerMsg.includes('failed to fetch') || lowerMsg.includes('network error')) {
    return 'O serviço de IA está temporariamente indisponível ou demorou muito para responder. Por favor, tente novamente em alguns instantes.';
  }
  
  if (lowerMsg.includes('unauthorized') || lowerMsg.includes('não autorizado') || lowerMsg.includes('token') || lowerMsg.includes('401')) {
    return 'Sua sessão expirou, é inválida ou foi acessada em outro dispositivo. Por favor, faça logout e faça login novamente para continuar.';
  }
  
  if (lowerMsg.includes('rate limit') || lowerMsg.includes('429')) {
    return 'Muitas requisições em pouco tempo. Por favor, aguarde um momento antes de tentar novamente.';
  }

  // Se não for um erro técnico mapeado, retorna a mensagem original ou um fallback genérico
  return msg || 'Ocorreu um erro inesperado. Tente novamente.';
}