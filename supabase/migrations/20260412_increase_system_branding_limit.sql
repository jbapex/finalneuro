-- Aumenta o limite de tamanho do bucket system_branding para 20MB
update storage.buckets
set file_size_limit = 20971520
where id = 'system_branding';
