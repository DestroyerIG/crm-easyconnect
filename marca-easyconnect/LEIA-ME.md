# Marca EasyConnect CRM (deste fork)

Esta pasta guarda a marca **do fork**: logo, logo para o tema escuro, ícone da aba, nome e cores.
Marca vive no banco (`platform_branding`), não no código — então ela não sobe junto com o `git pull`.
O script abaixo aplica estes arquivos no banco da máquina em que você rodar.

```bash
pnpm marca:easyconnect
```

Pré-requisitos: o `.env.local` com `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`
(o que o instalador local gera) e a stack no ar. É idempotente: rodar de novo troca o que mudou.
Reabra a página (a marca tem cache de ~30 s no servidor).

- `logo.png` — logo principal (fundo transparente, texto azul-marinho)
- `logo-escuro.png` — mesma logo, com texto branco, para o tema escuro
- `icone.png` — ícone da aba (quadrado, 512×512)
- `marca.json` — nome do sistema, nome da organização e cores

Para mudar a marca: troque os arquivos / o JSON e rode o script de novo.
**Não** proponha esta pasta em PR para o repositório original: marca de fork lá é vazamento.
