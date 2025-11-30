Atividade  2 – Web App Interativo de Curvas Paramétricas e Superfície de Revolução
Visão Geral do Sistema
Este Web App expande o anterior, oferecendo a criação de superfícies 3D com base em uma curva 2D.
Funcionalidades principais:
•	Criação de curvas Bézier e B-Spline no canvas 2D. 
•	Realização interativa de uma superfície de revolução 3D, com suporte a: 
o	Visualização 3D com Three.js (controles de órbita, zoom e pan). 
o	Alternância entre modos wireframe e sólido. 
o	Exportação nos formatos OBJ, STL e JSON.
Funcionalidades do Sistema
•	Adicionar pontos no canvas e movê-los com drag and drop. 
•	Recalcular a curva em tempo real. 
•	Alternar entre Bézier e B-Spline. 
•	Gerar superfícies de revolução baseadas na curva 2D. 
•	Visualizar superfícies 3D em tempo real utilizando Three.js. 
•	Suporte à exportação de dados. 
•	Limpeza do perfil desenhado para iniciar novos projetos.
Arquitetura
1.	index.html
o	Estrutura da interface, contendo: 
	Canvas 2D para desenho do perfil. 
	Container para visualização 3D (Three.js). 
	Botões de ação: 
	Adicionar Ponto, Gerar Superfície 3D, Selecionar Tipo de Curva, Exportar Dados e Limpar Perfil.
2.	style.css
o	Layout responsivo: 
	Organização clara das áreas 2D e 3D. 
	Suporte ao modo escuro. 
	Estilização dos botões e do canvas, adaptada a diferentes resoluções.
3.	main.js
o	Controle geral da aplicação: 
	Gerenciamento do estado do sistema: pontos, curva ativa, subdivisões e eixo de revolução. 
	Integração dos módulos de curvas, revolução e visualização 3D. 
	Eventos acionados pelos botões.
4.	curves.js
o	Implementação das curvas paramétricas: 
	Algoritmo de De Casteljau para Bézier. 
	Cálculo de curvas B-Spline cúbicas com vetor de nós uniforme. 
	Funções de amostragem e suavização da curva.
5.	revolution.js
o	Lógica para geração de superfícies 3D: 
	Construção de malhas rotacionando o perfil 2D em torno do eixo Y: 
	Criação de vértices, normais e faces triangulares. 
	Fechamentos perfeitos da malha.
6.	viewer.js
o	Renderização 3D com Three.js: 
	Configuração de cena, luzes, câmera e materiais. 
	Modos de exibição: wireframe e sólido. 
	Controles de câmera: órbita, zoom e pan.
7.	export.js
o	Exportação de dados para OBJ, STL (ASCII) e JSON, com implementação nativa (sem bibliotecas externas).
Dificuldades Encontradas
1.	Detecção precisa de cliques e seleção de pontos:
o	Implementação de cálculos avançados para: 
	Detecção precisa dos pontos clicados com base em distância. 
	Evitar erros em cliques simples e movimentos de pontos (drag & drop).
2.	Performance no canvas 2D:
o	Desafios para redesenhar a curva enquanto o usuário movimenta pontos, garantindo 60 FPS sem atrasos ou flickering.
3.	Geração de superfície de revolução:
o	Problemas de indexação e fechamento da malha para formar triângulos e evitar sombras invertidas.
4.	Integração entre 2D e 3D:
o	Coordenação de operações simultâneas, como: 
	Arraste dos pontos, 
	Recalculo da curva, 
	Geração da malha 3D, 
	Atualização do modelo renderizado.
o	Solução: foi criada uma ordem de atualização clara para evitar conflitos de execução.
