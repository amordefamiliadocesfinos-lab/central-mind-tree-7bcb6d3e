# Escopo — Perfil operacional canônico

- app_users é a única identidade operacional.
- avatar_url pertence a app_users.
- Produção e demais módulos apenas consomem essa identidade.
- Bucket dedicado: app-user-avatars.
- Fallback visual: iniciais do colaborador.
- Botão Produzir recebe prioridade visual no mobile.
