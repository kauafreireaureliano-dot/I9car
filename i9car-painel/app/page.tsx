'use client';

import { useState, useEffect } from 'react';

interface Carro {
  id: number;
  titulo: string;
  preco: string;
  ano: number;
  km: string;
  localizacao: string;
  link: string;
  imagem?: string;
  dataBusca: string;
}

interface Configuracao {
  regiao: string;
  precoMaximo: number;
  anoMinimo: number;
  distanciaKm: number;
}

export default function Home() {
  const [carros, setCarros] = useState<Carro[]>([]);
  const [configuracao, setConfiguracao] = useState<Configuracao>({
    regiao: 'São Paulo',
    precoMaximo: 50000,
    anoMinimo: 2015,
    distanciaKm: 100,
  });
  const [buscando, setBuscando] = useState(false);
  const [ultimaBusca, setUltimaBusca] = useState<string>('');

  // Carregar dados salvos
  useEffect(() => {
    const savedConfig = localStorage.getItem('configuracao');
    if (savedConfig) {
      setConfiguracao(JSON.parse(savedConfig));
    }

    const savedCarros = localStorage.getItem('carrosEncontrados');
    if (savedCarros) {
      setCarros(JSON.parse(savedCarros));
    }
  }, []);

  const salvarConfiguracao = (config: Configuracao) => {
    setConfiguracao(config);
    localStorage.setItem('configuracao', JSON.stringify(config));
  };

  const iniciarBusca = async () => {
    setBuscando(true);

    // Simulação da busca - em produção, isso chamaria uma API
    setTimeout(() => {
      const novosCarros: Carro[] = [
        {
          id: 1,
          titulo: 'Honda Civic EXL 2.0 Flexone 16V Aut.',
          preco: 'R$ 45.900',
          ano: 2018,
          km: '65.000 km',
          localizacao: 'São Paulo - SP',
          link: '#',
          dataBusca: new Date().toLocaleString('pt-BR'),
        },
        {
          id: 2,
          titulo: 'Toyota Corolla XEi 2.0 Dual VVT-iE Aut.',
          preco: 'R$ 48.500',
          ano: 2019,
          km: '52.000 km',
          localizacao: 'Guarulhos - SP',
          link: '#',
          dataBusca: new Date().toLocaleString('pt-BR'),
        },
        {
          id: 3,
          titulo: 'Hyundai HB20S Vision 1.6 Flex Aut.',
          preco: 'R$ 38.900',
          ano: 2017,
          km: '78.000 km',
          localizacao: 'Osasco - SP',
          link: '#',
          dataBusca: new Date().toLocaleString('pt-BR'),
        },
      ];

      setCarros(novosCarros);
      localStorage.setItem('carrosEncontrados', JSON.stringify(novosCarros));
      setUltimaBusca(new Date().toLocaleString('pt-BR'));
      setBuscando(false);
    }, 3000);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-blue-600 text-white shadow-lg">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">🚗 I9Car - Painel de Busca</h1>
              <p className="text-blue-100 text-sm">Automação Marketplace de Veículos</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-blue-100">Última busca</p>
              <p className="font-semibold">{ultimaBusca || 'Nunca'}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Configurações */}
        <section className="mb-8 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">⚙️ Configurações de Busca</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Região
              </label>
              <input
                type="text"
                value={configuracao.regiao}
                onChange={(e) => salvarConfiguracao({ ...configuracao, regiao: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: São Paulo"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Preço Máximo (R$)
              </label>
              <input
                type="number"
                value={configuracao.precoMaximo}
                onChange={(e) => salvarConfiguracao({ ...configuracao, precoMaximo: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ano Mínimo
              </label>
              <input
                type="number"
                value={configuracao.anoMinimo}
                onChange={(e) => salvarConfiguracao({ ...configuracao, anoMinimo: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Distância (km)
              </label>
              <input
                type="number"
                value={configuracao.distanciaKm}
                onChange={(e) => salvarConfiguracao({ ...configuracao, distanciaKm: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <button
            onClick={iniciarBusca}
            disabled={buscando}
            className="mt-6 w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {buscando ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Buscando...
              </>
            ) : (
              <>
                🔍 Iniciar Busca no Marketplace
              </>
            )}
          </button>
        </section>

        {/* Resultados */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800">
              📋 Veículos Encontrados ({carros.length})
            </h2>
            {carros.length > 0 && (
              <button
                onClick={() => {
                  setCarros([]);
                  localStorage.removeItem('carrosEncontrados');
                }}
                className="text-sm text-red-600 hover:text-red-800"
              >
                Limpar resultados
              </button>
            )}
          </div>

          {carros.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-12 text-center">
              <div className="text-gray-400 text-6xl mb-4">🚗</div>
              <h3 className="text-lg font-medium text-gray-700 mb-2">
                Nenhum veículo encontrado ainda
              </h3>
              <p className="text-gray-500">
                Clique em "Iniciar Busca" para encontrar oportunidades no Marketplace
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {carros.map((carro) => (
                <div key={carro.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="h-48 bg-gray-200 flex items-center justify-center">
                    <span className="text-gray-400 text-4xl">🚙</span>
                  </div>

                  <div className="p-4">
                    <h3 className="font-semibold text-gray-800 mb-2 line-clamp-2">
                      {carro.titulo}
                    </h3>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Preço:</span>
                        <span className="font-bold text-green-600 text-lg">{carro.preco}</span>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-gray-500">Ano:</span>
                        <span className="text-gray-700">{carro.ano}</span>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-gray-500">KM:</span>
                        <span className="text-gray-700">{carro.km}</span>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-gray-500">Local:</span>
                        <span className="text-gray-700">{carro.localizacao}</span>
                      </div>
                    </div>

                    <a
                      href={carro.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 block w-full text-center bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-md transition-colors"
                    >
                      Ver no Marketplace →
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}