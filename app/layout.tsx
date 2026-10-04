import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
title: 'I9Car - Painel de Busca',
description: 'Automação Marketplace de Veículos',
}

export default function RootLayout({
children,
}: {
children: React.ReactNode
}) {
return (
<html lang="pt-BR">
<body>{children}</body>
</html>
)
}