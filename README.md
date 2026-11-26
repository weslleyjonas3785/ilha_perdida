# Ilha Perdida — sobrevivência 3D em terceira pessoa

Jogo de sobrevivência em mundo aberto feito para navegador, em **WebGL2 puro com módulos ES**. Não depende de bibliotecas nem de etapa de build.

## Como executar

Os módulos ES precisam ser servidos por HTTP (abrir o `index.html` direto do disco não funciona):

```bash
cd survival3d
python3 -m http.server 8080
# abra http://localhost:8080
```

Navegadores suportados: Chrome, Edge, Firefox e Safari recentes, todos com WebGL2.

## Tecnologia e arquitetura

Neste ambiente não havia acesso à rede, então o Three.js não pôde ser instalado nem testado. Por isso o projeto usa um motor WebGL2 próprio, pequeno e modular (`src/engine`), e o jogo fica em `src/game`.

| Módulo | Responsabilidade |
|---|---|
| `engine/shaders.js` | PBR (GGX/Smith/Schlick) com materiais procedurais por faixa (metal escovado com riscos e desgaste nas arestas, tecido com trama, pele com subsuperfície, couro, madeira, pedra/concreto, casca, folhagem translúcida, terreno em camadas), bump por derivadas de tela, sombras suaves de 12 amostras, névoa de altura com dispersão solar, céu atmosférico, SSAO, bloom, ACES, gradação de cor e FXAA |
| `engine/renderer.js` | Iluminação (sol/lua + céu/chão), sombras PCF estabilizadas, neblina, tonemapping ACES, skinning na GPU, instancing, água com espuma/profundidade, céu procedural (nuvens, estrelas, lua), partículas |
| `engine/skeleton.js` | Esqueleto, clipes keyframe (formato compatível com glTF), Animator com crossfade e camada de ação mascarada (ex.: cortar enquanto anda) |
| `engine/gltf.js` | Carregador **GLB/glTF 2.0** com skin, animações e textura base |
| `engine/mesh.js` | Construtor de malhas procedurais com pesos de skinning |
| `game/humanoid.js` | Rig humano de 19 ossos, malha com pesos suavizados nas juntas e 25 animações |
| `game/androids.js` | Rigs, malhas low-poly e animações dos 14 androides inimigos |
| `game/creatures.js` | Fauna (cervo, javali), borboleta solar, gorila de combate e IA dos androides (audição, emboscada, salto, cobertura e recarga, investida que derruba árvores e destrói construções, veneno, broca, drones) |
| `game/textures.js` | Atlas de folhagem gerado em canvas (folhas, agulhas, grama, flores, palmeira, samambaia) com alfa recortado |
| `game/weapons.js` / `game/firearms.js` | Modelos das armas (pistola, fuzil, espingarda) e sistema de tiro: mira sobre o ombro, hitscan com dano por região, recuo, dispersão, recarga animada, impactos e traçantes |
| `game/world.js` | Ilha procedural de ~10 km (10.368 m): cordilheiras, rios, lagos, praias, cavernas, 5 cidades, 10 vilarejos, 4 indústrias, 4 bases militares e a malha de estradas; terreno fino gerado por blocos de 192 m e grid grosso de 24 m para o horizonte |
| `game/stream.js` | Streaming do mundo: carrega e descarrega terreno (3 níveis de detalhe), objetos, colisores e assentamentos ao redor do jogador, guardando o que foi alterado |
| `game/mapdata.js` | Canais do mapa extraídos da imagem de referência (gerado por `tools/mapdata.py`) |
| `game/map.js` | Mapa (tecla M) com relevo, rios, estradas e sítios; marcações persistentes com distância na tela e na bússola |
| `game/fauna.js` | Malhas e esqueletos do cervo (galhada) e do javali (presas e crina) |
| `game/physics.js` | Colisores em grade espacial, cápsula do personagem, degraus, plataformas, cavernas, raios da câmera |
| `game/player.js` | Controlador do personagem e máquina de estados de animação |
| `game/camera.js` | Câmera em terceira pessoa com colisão |
| `game/building.js` | Construção com prévia, encaixe em grade e validação |
| `game/items.js` | Itens, receitas e inventário |
| `game/environment.js` | Ciclo dia/noite, clima e partículas |
| `game/audio.js` | Áudio procedural (Web Audio) |
| `game/ui.js` | HUD, menus e painéis |
| `game/game.js` | Laço principal, interação, sobrevivência, combate e salvamento |

Otimizações:

- Instancing por células de 64 m e LOD para árvores distantes.
- Terreno com 3 níveis de detalhe e saias contra frestas.
- Grama gerada só perto da câmera.
- Sombras apenas num raio de 85 m.
- Frustum culling e criaturas congeladas quando estão longe.
- Predefinições de qualidade gráfica (Baixa/Média/Alta/Ultra) e opções separadas de SSAO, bloom, FXAA e detalhe de superfície.
- Árvores com LOD de cartões (menos cartões e maiores a partir de 70 m).

## Novidades (versão realista)

- **Armas de fogo**:
  - pistola 9mm, fuzil automático e espingarda de bomba;
  - botão direito mira sobre o ombro e R recarrega;
  - munição separada por calibre;
  - cabeça ×2,4, pescoço ×1,6, tronco ×1 e membros ×0,65, com queda de dano pela distância;
  - o disparo faz barulho e atrai androides.
- **Ferimentos**:
  - golpes fortes, garras e brocas causam sangramento (a bandagem estanca);
  - o escorpião envenena (antídoto ou kit médico);
  - indicador vermelho mostra de onde veio o dano.
- **Temperatura e roupas**:
  - a temperatura corporal depende da hora, da chuva, da altitude, de estar molhado, de fogueira e de abrigo;
  - jaqueta e colete aquecem;
  - mochila de lona (+8) e mochila militar (+16) ocupam o espaço "Costas".
- **Sítios** (com estradas):
  - vilarejo, com comida, roupas e mochilas;
  - complexo industrial, com sucata, circuitos e o robô transportador;
  - base militar, com fuzis, colete, mochila militar e muita munição, guardada por soldados e drones.
- **IA**:
  - soldados recarregam a cada 6 tiros correndo para trás de árvores, rochas ou paredes, e recuam feridos;
  - o tigre ouve passos de corrida e salta no jogador;
  - o rinoceronte em investida derruba árvores e destrói construções;
  - aranhas fazem emboscada rente ao chão;
  - abelhas atacam em grupo se você correr perto da colmeia;
  - drones de vigilância chamam reforços e atiram.

## Atualização: equipamento, furtividade, aranha e novos animais
- **Armas nas costas**: 2 espaços (direita/esquerda). Armas grandes (arco, fuzis, escopeta, sniper, machado, picareta, lança) vão direto para as costas ao pegar/fabricar; pistola e faca ficam no inventário.
- **Roupas com bolsos** (chapéu, camisa, colete, luvas, calça, sapatos) no boneco da aba Inventário. Roupa inicial sem bolsos; camisa/calça/colete fabricados têm 5 bolsos; militares têm mais bolsos e durabilidade.
- **Luvas e sapatos**: sem luvas, cortar/socar machuca a mão; descalço, andar machuca o pé (sangramento). Luvas e sapatos de fibra se desgastam.
- **Mochilas**: improvisada 20, pequena 35, média 55, grande 70, de escalada 110 espaços. **Peso**: acima de 25 kg você fica mais lento; correr (SHIFT) e o deserto dão mais sede.
- **Inventário**: ESPAÇO gira o item arrastado; botão O organiza; ⬇ larga tudo (ou só os selecionados com SHIFT+clique); arrastar para fora larga. No baú, a seta vermelha ⬆ põe tudo no baú e vira azul ⬇ para pegar tudo de volta.
- **Furtividade**: robôs têm cone de visão; escondido ou atrás deles você não é notado; eles vão ao último lugar onde te viram, procuram e voltam para o ponto de origem. **C4** fabricável com prévia verde/vermelha.
- **Tiros**: dano por região, tiro na cabeça mata animais, robôs e jogadores; balas mais rápidas; vidros das janelas militares quebram com som e deixam o tiro passar. Bloqueio só com armas brancas.
- **Morte**: a mochila fica no chão ao lado de um túmulo. **Kill feed** no canto superior direito.
- **Aranha-tanque**: colorida, cospe teia pelo traseiro (deixa você lento), espalha teias nas árvores; quem encosta vira alvo e animais viram casulo. Ao morrer solta a caixa das costas com loot.
- **Robôs** com cores diferentes por tipo; os armados miram direto quando te veem e andam com som robótico.
- **Dia 40 min / noite 15 min** reais; a noite é bem escura (use tocha, lanterna ou visão noturna). Área tóxica avisa perigo e faz tossir.
- **Tigre-canhão** novo (pantera blindada laranja e preta com duas metralhadoras giratórias nas costas).
- **Vaca** (4 pelagens) e **galinha/galo** novos. Vaca, cervo, galinha e javali não aparecem no deserto.
- **Colmeia cibernética** nova: com uma **tocha na mão** as abelhas ficam calmas, mas atacam assim que você pega o mel. Abelhas menores.
- **Borboletas solares** raras: grupos de ~3 em qualquer região, depois demoram a reaparecer.
- **Óculos de visão noturna** (só em áreas militares): vista no espaço do chapéu, arraste uma **bateria de célula** (achada em casas nas cidades) sobre ele e confirme. Liga/desliga com N; quando a carga acaba a luz verde apaga — clique direito no óculos para tirar a bateria.

## Veículos e combustível
- **Picape, sedã, hatch, SUV** (azul, verde, amarelo, vermelho) e **motos** espalhados pelas cidades e estradas. Os carros ficam **sem pneus e sem motor**; a moto é **só o chassi** (falta pneus, motor e câmbio). Não dá para arrastar o veículo: as peças têm de ser levadas até ele.
- Perto do veículo: **E** abre o **menu do veículo**. Arraste as peças do inventário para os encaixes (ou clique no encaixe). Clique com o botão direito num encaixe para tirar a peça. Precisa da habilidade **Mecânica**.
- Peças: **pneu de carro**, **pneu de moto**, **motor de carro**, **motor de moto**, **câmbio**. Achadas em indústrias, carros abandonados, vilarejos, bases militares e nas lojinhas dos postos.
- **Galão de combustível** (até 20 L): segure na mão. Perto de um veículo, **E abastece** (animação + barras do galão esvaziando e do tanque enchendo); **F retira combustível** (quantidade aleatória) — funciona também nos carros abandonados. Nas **bombas dos postos** (um em cada cidade, na estrada de saída), **E enche o galão**.
- Veículo completo e com combustível: **E para dirigir**. **W/S** acelera e freia/ré, **A/D** vira, **Espaço** freio de mão, **E** para sair. O combustível acaba com o uso; dá para atropelar inimigos (o mecha não).

## Mechas, lança-granadas e lança-foguetes
- **Mechas** guardam as bases militares (um por base; volta 3 dias depois de destruído). Grandes, blindados, com farol no peito que fica **vermelho** quando te vê. Atiram com duas metralhadoras giratórias e lançam mísseis dos ombros. Cada passo faz o som de passo pesado; quando param de atirar toca o som de "parando de atirar" e as pontas das armas ficam vermelhas, giram cada vez mais devagar e vão esfriando.
- Só te detectam **pela frente ou pelos lados**; agachado nas costas deles você passa despercebido.
- Tiros e golpes não fazem nada: o mecha só cai com **3 C4**, **2 foguetes** ou **14 granadas de fragmentação**.
- **Lança-granadas improvisado**: só fabricado (bancada, habilidade Mecânica), nunca achado. Munições (só em bases militares): **amarela** = fragmentação, **verde** = gás tóxico, **cinza** = fumaça (inimigos não enxergam através). **T** troca o tipo de granada.
- **Lança-foguetes**: só na **Base Militar Central**, dentro da zona tóxica. Os foguetes caem às vezes de robôs mortos dentro da zona tóxica.

## Livros e habilidades
- 9 habilidades: Carpintaria, Medicina, Engenharia, Mecânica, Elétrica, Agricultura, Metalurgia, Costura e Eletrônica. Cada uma só é liberada **lendo o livro** dela; receitas e construções de cada área ficam travadas (🔒) até lá. Itens básicos de sobrevivência (machado, picareta, lança, faca, tocha, arco, fogueira, barraca, mochila improvisada, luvas/sapatos de fibra) não precisam de habilidade.
- Você começa com o **Livro de Carpintaria**. No inventário, botão direito no livro → **Ler**: o personagem lê folheando as páginas, uma barra circular enche no centro da tela e, no fim, o livro some, toca o som de habilidade liberada e ela aparece na aba **Habilidades** (Tab). As que ainda não foram liberadas aparecem apagadas.
- Os livros são raros: **um de cada no mapa**, no lugar de origem (Medicina em hospitais, Costura em guarda-roupas, Eletrônica em laboratórios/bases militares, Mecânica/Metalurgia/Engenharia em indústrias e bases, Agricultura em vilarejos/cozinhas, Elétrica em indústrias/prateleiras). Depois de pego, reaparece **15 dias depois em outro lugar**.
- Novos: **Soro de reidratação** (Medicina) e **Canteiro elevado** (Agricultura) para colher frutas.

## Cidades, estradas e casas
- **Malha viária**: uma **rodovia central de asfalto** (pista larga, faixa amarela tracejada e faixas brancas nas bordas) atravessa a ilha de sul a norte. Dela saem **ramais de asfalto** (faixa branca tracejada) para todas as cidades, indústrias e bases militares, e **estradas de terra** para os vilarejos (as cidades do interior) e os laboratórios. Os caminhos contornam água, encostas e outros lugares; onde passam sobre a água há **aterro com guard-rail**.
- **15 cidades em grade** (a maior é a Cidade Central, na zona tóxica), como uma cidade de verdade: quadras de 44 m, ruas de **asfalto com calçada, meio-fio, faixa tracejada e faixas de pedestre**, cruzamentos e postes. Cada quadra tem **lotes cercados com cerca de madeira**, gramado e árvores, e **todas as casas ficam de frente para a rua** — não há mais casa solta no meio do nada.
- No centro de cada cidade: **igreja** (torre com sino e cruz), **loja** (toldo listrado e letreiro LOJA, com comida e água nas prateleiras), **oficina** (letreiro GARAGEM, pilhas de pneus, peças de carro nas estantes), **hospital**, **farmácia**, **prédios de apartamento** com sacadas e uma **praça com caixa d'água**. O ramal da rodovia entra pela rua principal; o **posto de combustível** fica logo na saída.
- **Vilarejos** (cidades do interior): uma rua de terra com casas cercadas dos dois lados, poço, postes e carros.
- **Casas de subúrbio** espalhadas pelos bairros: revestimento em 16 cores, acabamento branco, varanda com colunas e guarda-corpo, telhado de duas águas, chaminé, água-furtada, venezianas, garagem com portão de madeira, sobrados de 2 andares. Viradas para a rua e espelhadas aleatoriamente.
- **Interior das casas**: banheiro (box de vidro, vaso, pia com espelho), quarto (cama de casal, criados-mudos, quadro, guarda-roupa), sala (TV, sofá, mesinha, poltrona, tapete, plantas) e cozinha (bancada com pia, armários, geladeira, fogão, mesa redonda com 4 cadeiras); a ordem dos móveis muda de casa para casa. Armários, geladeira, criados-mudos e pia podem ser revistados.
- **Hospital de 2 andares** (térreo + 1º andar com escada): torres de vidro na entrada, marquise com cruz vermelha, letreiro HOSPITAL, aparelhos de ar no telhado. Saguão com recepção curva, cadeiras azuis e sofás; alas com quartos de macas, biombos verdes, soro e armários de remédio — a ordem muda em cada quarto.
- **Cavar** com a picareta (F): buraco de até 6 m, dá **terra** (areia no deserto); alargue para ir mais fundo; dá para fazer a base dentro do buraco. Não dá para cavar nas ruas e estradas.

## Água, chuva e composteira
- **Mais rios, lagos e cachoeiras**: rios novos descem dos morros até o mar (ou até outro rio) e empoçam em lagos; há lagos nas baixadas. As **cachoeiras** caem de um paredão na beira do rio, com gotas, névoa e som; em cima, um laguinho alimentado por um riacho.
- **Toda água natural é contaminada** (rio, lago, riacho, mar). **E** bebe direto (mata a sede, mas pode dar infecção intestinal); **F** enche uma garrafa de **água suja**. Na fogueira (**Tab → Cozinhar**) a água suja é **fervida** e vira **água potável**. Garrafas lacradas achadas nas casas continuam potáveis.
- **Chuva**: mais frequente, com respingos no chão. O **coletor de chuva** (barril com funil de lona; construção) junta a água da chuva, que é **potável** — até 10 garrafas; um visor na lateral mostra o nível. **E** enche as garrafas.
- **Composteira** (construção, habilidade Agricultura): **E** coloca **10 terras** (cavadas com a picareta) e **10 comidas**. Cheia, aparece uma **barra de compostagem** carregando em cima dela; quando termina, aparece um **✔ verde** indicando que está pronta. **E** pega **5 adubos**.
- **Adubo no canteiro** (E no canteiro): as frutas crescem no **dobro da velocidade** e as próximas 3 colheitas rendem mais. O canteiro agora leva terra em vez de areia.

## Construção por projeto (bandeira, projeto e martelo)
- **Bandeira de território** (menu B): marca sua área de **32 m de raio**. As peças do projeto só podem ser construídas dentro da área da **sua** bandeira (não dá para colocar perto da bandeira de outro jogador). Com o projeto ou o martelo na mão aparecem estacas amarelas no limite.
- **Projeto** (fabricação: 3 folhas + 2 fibras): na mão, **segure o botão direito** → aparece a **roda** com: fundação, fundação triangular, parede, meia parede, parede com porta, escada, escada vertical, telhado, rampa, telhado com alçapão e telhado triangular. Mova o mouse até a peça e solte. A prévia **encaixa sozinha** (bordas das fundações e telhados, topo das paredes, paredes para a escada vertical) e fica verde/vermelha. **Clique** para construir: o personagem **abre o projeto nas mãos** e a peça vai subindo. R ou a roda do mouse giram (fundação solta, escada e rampa).
- **Martelo de madeira** (2 galhos + 2 madeira + 2 fibras): olhando para a peça, **botão esquerdo repara** (gasta material do nível dela). **Segure o direito** → roda **Upar / Mudar posição / Demolir**. Níveis: **Galhos → Madeira → Pedra → Metal** (cada um mais resistente). **Demolir devolve metade** do material do nível atual.
- **Peças sem apoio caem** (tirou a fundação, caem as paredes e o telhado que estavam nela). **Explosões** (granada, C4, foguete) danificam as construções; metal aguenta muito mais. Parede com porta e alçapão abrem e fecham com E.

## Versão em um único arquivo (sites que aceitam só um .html)
`node tools/build_single.mjs` gera `dist/ilha_perdida.html` (~5 MB) com o código, o estilo, os ícones e os sons embutidos. É esse arquivo que vai para lojas/sites que pedem "um único arquivo .html".
- **Atualiza sozinho:** ao abrir, o arquivo confere o `version.json` publicado no GitHub (Pages e, se falhar, o raw do repositório). Se houver versão mais nova, baixa e abre a nova; sem internet, roda a cópia que está dentro dele. Para abrir sem atualizar: `?noupdate`.
- **Mouse:** clicar no jogo trava o mouse (a setinha some e o mouse gira a câmera). Se o site não deixar travar, o jogo entra sozinho no modo "mouse livre", que funciona igual. Esc solta.

## Explosões, granadas e dano nas construções
- **Fragmentação:** bola de fogo low-poly com estilhaços de fogo, brasas, terra voando e fumaça escura; clarão forte na tela de quem está olhando; **abre cratera no chão** e fere todos num raio de 9 m.
- **Luz:** quem está perto e olhando fica com a **tela branca por 4 s** e zumbido; depois a visão volta **embaçada aos poucos** (3 s).
- **Fumaça:** nuvem **densa e baixa** (altura de uma pessoa) de bolas cinza que cobre só a área onde caiu (**~8 m**) e dura **15 s**; dentro dela não se vê nada (a tela fica cinza) e os robôs não te enxergam.
- **Barulhenta:** 3 s depois de jogada toca a **sirene** (som próprio) por **7 s**, que vai abaixando até parar. Robôs correm até ela atirando; **sentinelas e o mecha jogam bombas** nela. NPCs que ouvem vão procurar no barulho; dos que já tinham te visto, só alguns vão — os outros continuam atrás de você.
- **C4:** a mais forte — **20 m** de raio: derruba árvores, quebra rochas, mata animais e robôs (o mecha aguenta 3 C4), abre cratera funda, quebra vidros e deixa **chamas no chão**.
- **Construções:** levam dano de **tiro** (madeira aguenta ~30 tiros de fuzil; pedra e metal quase não sentem), **granadas/foguetes** e **C4**, com **barra de vida** sobre a peça atingida. C4: galhos/madeira e tudo o que foi construído no raio (bancadas, baús, fogueiras, máquinas) **cai na hora**; **pedra** (o dobro da vida da madeira) aguenta **1 C4** e cai na 2ª; **metal** aguenta **2** e cai na **3ª**.
- **Inventário (Tab) → Próximo:** mostra o loot que está no chão perto de você (mochilas, armas largadas, galhos, pedras, flechas…); clique num item para pegar ou em **Pegar tudo**.
- **Lupa:** móveis, caixas e carros que ainda têm loot mostram uma **lupa** em cima; depois de vasculhar, ela some.
- **Barra rápida:** mostra a **quantidade** dos itens que acumulam; quando acaba, o item **sai do slot**.

## Painel do dono do mundo (Ctrl + Shift + F1)
Só aparece para quem criou o mundo (no jogo solo sempre; no multiplayer só para o dono que hospeda — os amigos não abrem).
- **DROPAR:** todos os itens do jogo por categoria (armas, munição, saúde, comida, roupas, materiais…) e também **NPCs, robôs e animais**. Escolha a quantidade e o destino (**aos seus pés**, **onde está mirando** ou **perto de um jogador**). Dá para montar uma **lista** e **Dropar tudo** de uma vez.
- **MODO DEUS:** imortalidade, vitalidade infinita (fome/sede/energia), durabilidade infinita, invisibilidade, munição infinita, um tiro mata, **voar pelo mapa** (Espaço sobe, C desce, Shift acelera), **esqueletos com nome e ID** dos jogadores (e das criaturas) através das paredes, **itens no mapa**, regeneração rápida e proteção ambiental. **Teleportar pelo mapa:** abre o mapa e você vai para onde clicar.
- **Jogadores** (ir até / trazer um amigo), **Mundo** (hora, clima, matar inimigos por perto, chamar comboio, repor loot), **Sistema** (FPS e contagens) e **Console** (`give id qtd`, `spawn tipo qtd`, `tp x z`, `time 0.5`, `weather chuva`, `god on`, `heal`, `kill 80`, `items busca`).

## Multiplayer por IP (Radmin VPN)
Todos entram na mesma VPN (Radmin VPN, Hamachi, ZeroTier…) ou na mesma rede de casa.
- **Dono do mundo:** baixe o jogo do GitHub (Code → Download ZIP), descompacte e dê dois cliques em **Hospedar mundo.bat** (precisa do [Node.js](https://nodejs.org), versão LTS; no Linux/macOS rode `hospedar.sh`). Se o Firewall do Windows perguntar, clique em **Permitir**. A janela preta mostra o IP da VPN (no Radmin começa com 26.) e abre o jogo; no menu vá em **Multiplayer → Hospedar**, escolha o nome do mundo e uma senha (opcional). Deixe a janela preta aberta enquanto jogarem.
- **Amigos:** abrem o jogo (pelo link do GitHub mesmo), **Multiplayer**, colam o **IP do dono**, clicam em **Buscar**: aparece o mundo, quantos jogadores e se tem senha. Digitam a senha (se tiver) e **Entrar**. O jogo passa a ser carregado do PC do dono.
- O navegador do dono roda o mundo (robôs, NPCs, animais, loot) e manda para os outros: todos veem os mesmos inimigos, construções, fogueiras, baús, loot no chão, caixas saqueadas, árvores cortadas e portas. Tiros e dano funcionam entre jogadores (PvP) e nas criaturas. O personagem de cada amigo (inventário, roupas, posição) fica salvo no navegador dele; o mundo fica salvo no PC do dono.

## Bases, patrulhas, acampamentos e sinais de fumaça
- **NPCs com braços humanos** (manga comprida e mãos): só o jogador tem os braços robóticos.
- **Bases militares**: uns **30 soldados armados** e **uma sentinela (mecha)** em cada base. A **base da zona tóxica** não tem soldados: só **robôs** (guarnição de androides, pesados, aranhas-tanque e drones) e **três sentinelas**.
- **Patrulhas militares** (4 soldados) em mais ou menos metade das cidades, andando em formação pelas ruas da grade.
- **Acampamentos de civis** espalhados pelo mapa: **cabanas de madeira**, uma barraca, **fogueira** e caixas; os civis ficam andando em volta.
- **Sinal de fumaça**: toda fogueira acesa (do jogador ou dos acampamentos) solta uma coluna de fumaça alta, acima das árvores, vista de longe — menos quando a fogueira está **dentro de construção** (embaixo de piso/teto, de um abrigo ou dentro de um prédio). **À noite** a claridade da fogueira (brilho e a base da fumaça alaranjada) é vista de longe.
- **Granada**: segurando o botão esquerdo o personagem fica com o **braço erguido para trás** na posição de arremesso; ao soltar ele **joga para frente**.
- O **carregador** do comboio anda curvado **segurando forte as alças** do mochilão, que fica **encaixado nas costas** (da cintura até os ombros).

## Comboio, fogueira, doenças e desmaio
- **Comboio militar**: um **carregador** curvado sob uma carga enorme (caixa de madeira, mochilão, bolsas e saco de dormir), escoltado por **15 soldados armados**, anda em formação pelas estradas até uma base militar. Lá eles entram no alojamento e somem sem ninguém ver.
  - Se alguém atira perto (ou eles te veem), todos procuram de onde veio o tiro; quando acham, vão atrás e atiram. O carregador **foge correndo com a carga** junto com alguns guarda-costas e some quando não há ninguém por perto. Morto, deixa a carga no chão (munição, granadas, remédios, peças…).
  - **Armadilha de granada** (construção: granada de fragmentação + fibra + galhos): um fio entre duas estacas; quem tropeçar detona a granada 1 s depois. O comboio **identifica a armadilha** na estrada: para, recua, um soldado vai agachado desarmar e eles seguem.
- **Fogueira com inventário** (E na fogueira): **combustível** (lenha, galhos, folhas, carvão), **grelha** com 4 lugares e **sobras**. Lenha queimada vira **carvão**; carvão queimado vira **cinza**. Sem combustível a fogueira apaga (botão Acender/Apagar no menu).
  - A carne fica **assando na grelha, à vista**: crua → assada (som de assado e a cor muda) → **queimada** se demorar. Dá para pegar só **mirando nela** (E). Assar saiu da lista de fabricação.
  - Carnes **assadas** e **queimadas** de vaca, javali, galinha, cervo e humana, com os ícones das imagens.
- **Kuru**: comer carne humana (crua, assada ou queimada) dá kuru — tremores, a mira não fica firme e dá trancos para cima e para os lados. Com kuru, **qualquer outra comida faz vomitar** (perde metade da fome e da sede).
- **Comer demais**: com a fome em 100%, continuar comendo faz vomitar e **desmaiar** (tela escura); depois você acorda.
- **Carne queimada**: uns 10 minutos (do jogo) depois de comer, começa a vomitar e fica intoxicado.
- As doenças (água contaminada, carne crua ou queimada, kuru, radiação) **continuam depois de sair e entrar no jogo**, até tratar.
- **Desmaio por tiro**: um tiro que tira 70% da vida derruba — o personagem cai **de peito no chão** e fica desacordado. Se for atingido desmaiado, é **finalizado**: mexe os braços no chão e fica uma **poça de sangue**. A morte comum deixa o corpo **de barriga para cima**. Vale para você e para os NPCs.
- **Granada de luz**: quem está de frente fica com a tela toda branca (como no CS) e, ao voltar, a imagem fica turva até normalizar.

## NPCs, granadas de mão e bifes
- **Acampamentos de saqueadores** espalhados em lugares aleatórios: civis (camisa xadrez, regata e calça cargo, jaqueta verde com faca, velho de chapéu com espingarda). Quando avistam você, **gritam** e avisam os outros; os que têm arma de fogo atiram, os de faca, machado ou porrete partem para cima.
- **Soldados** (camuflado verde com máscara, tático azul, deserto de boné e óculos, boina vermelha) guardam as **bases militares** junto com a **sentinela gigante** — os robôs comuns não aparecem mais nelas. Na base da zona tóxica só há robôs. **Soldados/saqueadores e robôs se atacam** quando se veem.
- **Tudo faz barulho**: passos (correndo mais, agachado quase nada), gemidos de dor, trocar de arma das costas, subir escadas, abrir porta, beber, comer, cortar árvore, quebrar pedra… Robôs, animais e NPCs por perto ouvem e vão ver o que foi.
- **Picotar corpos**: com faca ou machado na mão, perto de um corpo humano aparece **E Picotar o corpo**. O personagem corta, uma barra enche e no fim sobram no chão a mochila, as roupas, as armas, o **bife humano** e os **ossos**.
- **Granadas de mão** (bases militares e soldados): **fragmentação**, **luz (flash)**, **fumaça** e **barulhenta**. F puxa o pino — na mão a granada ativa em 5 s; depois de jogada, todas explodem/ativam 3 s depois. O C4 explode 4 s depois de colocado. Segurando o **botão esquerdo** aparece a **barra de força** (verde → amarelo → vermelho) com um marcador preto indo e voltando: solte no verde para jogar perto, no amarelo para meia distância e no vermelho para jogar longe. Depois de jogada: fragmentação em 5 s (mata ou fere conforme a distância), luz e fumaça em 3 s. **Luz**: tela branca por 4 s com zumbido no ouvido; NPCs ficam cegos com o braço no rosto e robôs perdem o alvo. **Fumaça**: a nuvem cresce aos poucos; dentro dela os robôs não te veem e os NPCs ficam em alerta, só atirando se te virem. **Barulhenta**: buzina alta — robôs vão até ela atirando para destruí-la e NPCs na direção em que você jogou te veem e vêm atrás.
- **Bifes**: vaca, javali, galinha, cervo e humano, cada animal dá o seu (cru pode intoxicar; asse na fogueira).
- **Escadas verticais** na lateral dos hospitais e prédios levam ao telhado (E agarra; W/S; Shift rápido/escorrega; Espaço solta).
- **Cidades maiores**: as médias têm mais de 150 construções acessíveis, as pequenas mais de 100, e a Cidade Central (zona tóxica) cerca de 450 entre casas, prédios e laboratórios. Entrando na zona tóxica sem a roupa R.A.T você começa a **tossir**; 5 minutos exposto e fica **infectado**.

## Mundo de 10 km e mapa

- O mapa segue a arte de referência (`tools/mapa_referencia.png`), convertida por `tools/mapdata.py` em canais de bioma, costa, rios e lagos (`src/game/mapdata.js`):
  - cordilheira nevada a noroeste, com lagos de montanha;
  - deserto a nordeste, com mesas em degraus e cactos;
  - pântano a oeste, com lagoas, árvores secas e juncos;
  - florestas e morros rochosos no centro e no sul, cortados por rios que descem até o mar;
  - ilhotas ao redor, que dá para alcançar nadando.
- A ilha tem cerca de 10 km de lado. Uma **parede invisível** nos limites do mapa (±5 050 m) impede sair do mundo; o mar continua visível além dela.
- **5 cidades**, 10 vilarejos, 4 indústrias e 4 bases militares, ligados por estradas com carros abandonados. O jogo começa na península sudoeste, perto de **Porto Cinza**.
- O mundo é carregado em blocos de 192 m ao redor do jogador. Árvores cortadas, rochas mineradas e itens coletados continuam assim quando você volta, e ficam no salvamento.
- **M** abre o mapa: roda dá zoom, arrastar move, clique marca um ponto (até 8). As marcações aparecem no jogo com a distância e na bússola, e ficam salvas.

## Personagem

- Ao começar um jogo novo, a tela **Criar personagem** define nome, estilo de cabelo (espetado, curto, longo, moicano) e as cores do cabelo, jaqueta, camiseta, calça e tênis. O nome aparece no canto da tela; a aparência fica no salvamento.
- **Shift + C correndo**: carrinho. No plano o personagem escorrega pouco mais de 1 s; em descida continua e acelera enquanto a ladeira empurrar. Espaço durante o carrinho sai pulando.

## Armas, calibres e lunetas

| Arma | Munição | Dano | Luneta |
|---|---|---|---|
| Pistola .35 | .35 | 22 | não |
| Pistola .42 | .42 | 30 | não |
| Pistola .65 Magnum | .65 | 50 | não |
| Escopeta | cartuchos de escopeta | 9 × 15 | não |
| Fuzil de assalto 5.40 | 5.40 | 28 | 4x |
| Fuzil de assalto 5.55 | 5.55 | 34 | 4x |
| Fuzil de assalto 5.77 | 5.77 | 41 | 4x |
| Fuzil de precisão 7.45 | 7.45 | 74 | 4x ou 8x |
| Fuzil de precisão 7.69 | 7.69 | 88 | 4x ou 8x |
| Fuzil de precisão 7.90 | 7.90 | 108 | 4x ou 8x |

- Botão direito segurado: mira. Botão esquerdo: atira.
- Com luneta encaixada, segurar o botão direito abre a luneta e a roda do mouse ajusta o zoom (4x: 3x–5x; 8x: 6x–10x).
- A **4x** tem hastes grossas, chevron vermelho e marcas numeradas 1–4 (×100 m); a **8x** tem retículo fino de mil-dots com postes nas bordas.
- Para encaixar: com o fuzil na mão, use a luneta pela barra rápida ou pelo inventário ("Encaixar na arma da mão"). Para tirar: aba Equipamentos → "Remover luneta".
- Lunetas aparecem em bases militares (e raramente em carros e cidades). Munições antigas do salvamento são convertidas (9mm → .42, 5.56 → 5.55, 7.62 → 7.69).

## Acessórios das armas (Verificar)
- Botão direito numa arma de fogo (na grade, na mão ou nas costas) → **Verificar**: mostra a arma desenhada com o que está encaixado e os espaços **Pente**, **Mira** e **Silenciador**. Pistolas: só pente e silenciador; escopeta e armas especiais: sem espaços.
- Clique num acessório compatível da mochila para encaixar; clique no espaço ocupado para tirar (o pente devolve as balas que estavam nele).
- Pentes: Pente de pistola, Pente FA 5.40 / 5.55 / 5.77 (curvos) e Pente FP 7.45 / 7.69 / 7.90 (caixa). A arma encontrada já vem com o seu pente; **sem pente ela não recarrega nem atira**.
- Miras: Luneta 4x e 8x.
- Silenciadores (5 modelos): de pistola; de fuzil de assalto médio e longo; de precisão grande e máximo. Tiro abafado e sem clarão; quanto maior o silenciador, menor a distância em que os inimigos ouvem (de ~1/3 até ~1/6).
- Ícones de todos os acessórios gerados dos modelos 3D (`tools/gun_icons.py`, que usa `src/game/iconrender.js`).
- Armas grandes coletadas (chão, caixas, corpos) vão direto para as costas; com os 2 espaços ocupados, vão para o inventário.

## Helicóptero militar
- De tempos em tempos (primeira vez depois de ~5 a 8 min) um helicóptero verde-oliva "07" cruza o céu passando perto de você. O som do rotor é estéreo e muda com a distância: dá para saber de que lado ele vem.
- Tripulação de verdade: o piloto (no banco da direita, visível pela cabine) e 2 atiradores sentados na porta esquerda, segurando o fuzil com as duas mãos. Todos podem ser mortos; o atirador morto cai lá de cima.
- Hélices girando com rastro de movimento (borrão) e disco translúcido; rotor de cauda também.
- Se ele te vê (a céu aberto, sem fumaça, perto), faz a volta e fica circulando em cima com a porta aberta: os atiradores disparam rajadas. Esconda-se embaixo de teto, entre árvores ou numa granada de fumaça — sem te ver por ~14 s, ele vai embora.
- Atire no **piloto** pela janela da cabine (a fuselagem só faz faísca) ou acerte um foguete: o helicóptero perde o controle, gira, cai pegando fogo, explode e deixa destroços em chamas (coluna de fumaça preta) com 6–8 caixas militares de loot e os corpos da tripulação em volta.
- Painel do administrador: botão **Chamar helicóptero**. No multiplayer ele aparece só para quem hospeda o mundo.

## Celular (navegador)
- Abrindo o jogo no celular/tablet, ele detecta sozinho e mostra os controles de toque (no computador eles não aparecem): joystick fixo (W/A/S/D), MOCHILA, ATIRAR, MIRAR, PULAR, USAR, AGACHAR, RECARREGAR, CORRER (liga/desliga), OMBRO, PINO da granada, MÃOS, MAPA, CONSTRUIR e PAUSA. Arrastar o dedo no resto da tela gira a câmera; a barra 1–8 embaixo seleciona o item com um toque.
- No primeiro toque o jogo entra em tela cheia e trava na horizontal (Android/Chrome). Se o celular estiver em pé (ou o navegador não deixar travar, como no iPhone), aparece o aviso para girar.
- Botão **DESLIZAR**: correndo (CORRER ou trava de corrida), o personagem dá o carrinho/deslize, igual a apertar C correndo no PC.
- Com arma de fogo na mão, o botão USAR vira uma bala (ATIRAR). O botão grande da esquerda é só o desenho de uma bala.
- Puxar a bola do joystick para cima e arrastar além do círculo trava a corrida (aparece o cadeado CORRER); o personagem segue correndo ao soltar, e tocar no joystick de novo destrava.
- ⚙ Engrenagem → **Modificar controles**: o jogo para e abre a tela com todos os botões (inclusive Girar/Sair da construção). Toque num botão para escolher, arraste para mudar de lugar, use − / + (ou a barra) para o tamanho dele, e ajuste o tamanho de todos e a transparência. **Salvar** grava do jeito que ficou (no aparelho); **Cancelar** desfaz; **Restaurar padrão** volta ao original. O painel pode ser arrastado pelo título.
- **PAUSA** abre o menu de pausa, igual ao ESC do computador (no celular deitado o menu fica em 2 colunas para caber na tela).

## Roupas, mochilas e baterias (clique no inventário)
- O personagem começa com **tênis** (e camiseta e calça velhas). Saves antigos com "Sapatos velhos" no pé trocam para o tênis.
- Mochila: pegar (chão, caixas, área Próximo) ou clicar numa mochila maior que a atual veste ela na hora; a antiga vai para o inventário (ou para o chão, se não couber).
- Bateria: clicar pergunta se quer equipar e mostra onde colocar (óculos de visão noturna na cabeça ou na mochila; se ele já tiver bateria, oferece trocar).
- Roupa: clicar pergunta o que fazer — **Vestir** (mostra o lugar e o que vai trocar) ou **Cortar em retalhos** (vira Pano) com um objeto cortante (faca, machado ou lança) no inventário, nas costas ou na mão.

## Imagens dos itens
- Recursos, comida, bebidas, remédios, munições, roupas, peças de veículo, ferramentas e máquinas têm imagem própria no inventário (recortadas das folhas enviadas, fundo removido, 160 px). Carne crua/assada usam as imagens de carne já existentes.
- Pneus por carro: Pneu de SUV, de sedã, de hatch e de picape (cada carro pede o seu; o antigo "Pneu de carro" vira universal e serve em qualquer carro).
- Placa solar (construção): poste de madeira remendado com asas de borboleta solar formando os painéis, cabos até a caixa de munição do controlador, bateria e inversor com tomada.
- Coletor de chuva: lona furada esticada em 4 varas escorrendo para 2 barris enferrujados, calha, torneira, balde, pedras e capim; o visor de nível fica no barril alto.

## Voz por proximidade
- **CAPS LOCK** liga o microfone e ele fica aberto até apertar de novo. Quem estiver perto (até ~45 m) ouve, com volume pela distância e lado pelo estéreo.
- No PC aparece o desenho do microfone no alto da tela, embaixo da bússola; ele acende e apaga enquanto você fala e some ao desligar.
- NPCs e robôs também ouvem quando você fala e vão na sua direção (quanto mais alto, mais longe chega).
- O navegador só libera o microfone com o jogo em https (site) ou no próprio PC (localhost).
- Celular: botão **VOZ** com o microfone riscado (desligado); ligado ele fica aceso, sem o risco.

## NPCs com arma longa
- Soldados e saqueadores seguram fuzil e escopeta com as duas mãos (mesma empunhadura do jogador: mão direita no punho, esquerda no guarda-mão), tanto parados quanto mirando, e a arma aponta para o alvo.

## Animais e robôs novos

- **Cervo** com galhada e **javali** com presas e crina: dão carne e couro.
- **Gorila de combate**: robô pesado com punhos enormes, que avança em investida.
- **Androide soldado**: capacete com visor vermelho e submetralhadora.
- **Borboleta solar**: do tamanho do jogador. Abatida, cai no chão e dá **placas solares** no formato das asas. Na bancada, placa solar + circuito + sucata viram uma **lanterna solar**.

## Arpão-gancho, impressora 3D e energia

- **Arpão-gancho**: só sai da **impressora 3D** (nunca é encontrado). Custa filamento 4, peças de armas 2, sucata 4, circuitos 2 e ferro 2. A **munição de arpão** é feita na bancada (corda 2, ferro 1, sucata 1); cada uma dá **3 disparos** (R recarrega quando acabar). Mirando (botão direito), a mira fica **verde** quando o ponto está ao alcance (até 40 m, com a distância ao lado) e **vermelha** quando não dá. O arpão crava, a corda recolhe e puxa você até o ponto; clique de novo ou pule para soltar. Acertar um bicho causa dano.
- **Impressora 3D**: fabricada na bancada e posicionada no chão (inventário → Posicionar). Coloque filamento (achado em casas, indústrias e laboratórios), escolha a peça (peças de armas, arpão, lunetas 4x/8x) e ela imprime usando 60 W; o cabeçote se move e a peça cresce na mesa. Retire na bandeja.
- **Rede elétrica**: fabrique **fio de cobre** na bancada (circuito + sucata = 4 fios). No aparelho, **Puxar fio daqui**, leve até outro aparelho e aperte E (1 fio a cada 5 m, máx. 30 m; X cancela). Toda rede precisa de um **painel elétrico**. Fontes: **placa solar** (até 60 W de dia), **turbina eólica** (mais com vento/tempestade, até 120 W) e **roda d’água** (90 W constantes, na beira de rio ou lago de água doce). **Baterias** guardam a sobra (6 kJ cada) e alimentam a impressora à noite.
- **Contador Geiger**: item de mão (laboratórios, bases militares ou impressora 3D). Aponte para as coisas — o mostrador e a barra mostram a radiação daquela direção em mSv/h (Seguro / Baixo / Alto / PERIGO) e dizem a origem: zona tóxica ao longe, itens contaminados no chão, objetos contaminados ou sua mochila. Botão direito aponta com mais precisão; os estalos aceleram com a leitura.
- **Exposição à radiação**: dentro da Cidade Morta sem a R.A.T toca o contador Geiger e aparece uma barra de radiação com contagem acima das barras do personagem. No miolo da área você tem **3 minutos** (a barra chega a 50%) para sair. Aos 50% você fica **contaminado**: a radiação continua subindo mesmo fora da área e, se não tomar o **remédio antirradiação** (frasco branco), você morre ao chegar em 100%.

## Zona tóxica, roupa R.A.T e inventário em grade

- **Cidade Morta** (maior cidade, no ponto marcado no mapa): coberta por névoa tóxica verde, visível de longe. Sem a roupa **R.A.T** (Roupa de Área Tóxica) você acumula radiação, intoxicação e falta de ar; contador Geiger toca conforme a intensidade. Dentro: androides armados e máquinas mutantes.
- **Roupa R.A.T**: aparece dobrada em bancadas de **laboratórios** (4 no mapa). Ao vestir, o personagem fica com o traje amarelo, capuz com visor, máscara de gás, cinto, luvas e botas pretas e mochila preta com faixa amarela. A roupa e a mochila que você usava (com o que havia dentro) caem no chão ao lado. A mochila da R.A.T tem só 12 espaços (4×3).
- **Inventário (Tab)**: grade estilo tetris. Bolsos 5×3 + mochila. Munição ocupa 1 célula, lata de comida 2, armas várias (R gira o item ao arrastar). Coluna de equipamento: mão, Roupa R.A.T, roupa/colete e mochila; barra rápida 1–6 por arrastar.
- **Mochilas**: improvisada 10 (fabricável), pequena 20, média 25, grande 30 (casas e caixas), escalada 40 (só zona tóxica e bases militares). Uma mochila achada sem nenhuma nas costas é vestida na hora.
- **Contaminação**: tudo que é pego dentro da zona tóxica fica marcado ☢ e irradia você (a menos que esteja de R.A.T). Para limpar, use **sabonete líquido** (achado em casas) e interaja com um rio ou lago (E): gasta 1 sabonete e lava tudo.
- (Radiação detalhada na seção acima.)
- **Doenças** (símbolos acima das barras, na cor do remédio): verde = toxinas/veneno/enjoo; laranja = febre/inflamação (ferimento sem tratar, molhado no frio); amarelo = fadiga/fraqueza (sem energia/comida); azul = hipotermia/falta de ar; ☢ radiação = só o **frasco branco antirradiação** (laboratórios e bases militares). Comprimidos vêm em cartelas com quantidade aleatória (casas, hospitais, farmácias).
- **Animações com som**: comer (mordidas), beber (goles), frasco (desrosqueia, despeja na mão, leva à boca, rosqueia) e cartela (destaca o comprimido e joga na boca).
- **Casas completas**: cozinha (armário, geladeira), sala (estante) e quarto (criado-mudo, guarda-roupa), banheiro (armário de remédios) — todos os móveis podem ser revistados. Hospitais, farmácias e laboratórios têm interiores próprios.
- **Bases militares**: cercadas com uma única entrada, torres, tendas, galpões com caixas militares grandes e contêineres com loot militar bom. Só androides soldados armados.

## Defesa

- **Botão direito defende** só com armas brancas na mão: faca, machado, picareta ou lança. Golpes de frente perdem 85% do dano (70% com faca), gastam estamina e atrasam o próximo ataque do inimigo. De mãos vazias, com tocha ou outros itens não há defesa. **Tiros e explosões não podem ser defendidos.**
- Facas: faca de pedra (2 pedras, 1 graveto, 1 fibra) e faca de sucata (bancada); são rápidas e leves.

## Tiros e sons

- Cada bala é desenhada como um **feixe de tiro** dourado (núcleo brilhante + rastro de fogo e faíscas, com a bala de latão na ponta), saindo do cano e sumindo rápido ao acertar. Os tiros dos androides soldados usam o mesmo feixe.
- Sons gravados: pistola, fuzil de assalto (um disparo por tiro, para o modo automático), escopeta e fuzil de precisão; cada calibre tem um tom levemente diferente (ex.: .35 mais agudo, .65 mais grave). Androides soldados usam o som de fuzil.

## Balística e câmera

- Balas e flechas são projéteis com gravidade e arrasto, não tiros instantâneos. De longe é preciso mirar acima do alvo.
- Queda medida a 200 m: pistola 19 m (fora do alcance útil), fuzil 5.56 4,7 m, fuzil de precisão 7.62 2 m. A flecha não chega a 200 m.
- Fuzil de precisão 7.62 (base militar): ferrolho, 5 tiros, luneta com visão pelo olho do personagem e marcas de compensação para 100/200/300/400 m, calculadas pela velocidade real da bala.
- **Q** troca a câmera de ombro (direito ↔ esquerdo); a escolha fica salva. A defesa corpo a corpo ficou só no botão direito.

## Controles

**Computador**

| Tecla | Ação |
|---|---|
| W A S D | Mover |
| Mouse | Câmera (clique na tela para capturar o mouse) |
| Roda do mouse | Zoom |
| Shift | Sprint |
| Alt ou Caps Lock | Caminhar devagar |
| Espaço | Pular ou escalar obstáculos de até ~1,6 m |
| C | Agachar (furtivo: dano dobrado em inimigos distraídos) |
| E | Interagir, coletar, beber |
| F ou clique esquerdo | Usar ferramenta ou atacar |
| Clique direito (segurar) | Mirar / abrir a luneta (sem arma: defender) |
| Clique esquerdo | Atirar |
| Shift + C | Carrinho (correndo) |
| Q | Trocar a câmera de ombro |
| M | Mapa (clique marca um ponto; clique na marca remove) |
| Tab | Inventário e fabricação |
| Ctrl + Shift + F1 | Painel do dono do mundo (dropar e modo deus) — só para quem criou o mundo |
| I | Equipamentos |
| B | Construção (R gira a peça, X desmonta) |
| 1 e 2 | Armas grandes (fuzis, escopetas, machados, picaretas, lanças, arco) |
| 3 | Pistola ou faca |
| 4–8 | Outros itens (comida, remédios, granadas, ferramentas pequenas…) |
| E (perto de escada) | Agarrar a escada: W/S sobe e desce, Shift sobe rápido / escorrega descendo, Espaço solta |
| F (granada na mão) | puxa o pino |
| Segurar botão direito (Projeto na mão) | roda das peças de construção; clique constrói |
| Martelo na mão | clique repara; segurar o direito: Upar / Mudar posição / Demolir |
| Segurar e soltar botão esquerdo (granada sem pino) | barra de força: verde perto, amarelo médio, vermelho longe |
| 0 ou H | Guardar a ferramenta |
| Esc | Pausa |

**Celular**

- Joystick dinâmico no lado esquerdo.
- Arrastar no lado direito gira a câmera.
- Botões: atacar, pular, interagir, defender, correr, agachar, inventário, construção e pausa (e girar/sair durante a construção).

## Ciclo de jogo

1. Colete galhos, pedras e fibras do chão, e frutas e folhas dos arbustos.
2. Fabrique um machado (Tab → Fabricação). Itens fabricados ou coletados vão para a **mochila**. Arraste o machado para um espaço da **barra rápida (1–6)** e aperte a tecla do número para empunhá-lo; ele continua no espaço e a mesma tecla o guarda.
3. Corte árvores. Elas caem com física animada e deixam troncos, e cada tronco dá 4 de madeira.
4. Com a picareta, minere rochas. As rochas ricas das cavernas também dão sucata e cristais.
5. Construa fogueira, barraca ou abrigo, piso, paredes, porta, baú e bancada. Na bancada ficam as receitas de sucata e as armaduras.
6. Mantenha vida, fome, sede, energia e resistência:
   - Beba em rios e lagos (a água do mar é salgada).
   - Asse a carne na fogueira (crua pode intoxicar).
   - Durma na barraca ou no abrigo à noite, o que também define o ponto de renascimento.
7. Os inimigos são androides (lista abaixo). À noite aparecem mais e mais fortes. Destruídos, eles podem ser desmontados (E) e rendem sucata, circuitos e núcleos de energia, usados na bancada para a **Lança de choque** e a armadura de sucata. As ruínas guardam caixas com sucata, pano, comida enlatada e água.
8. Ao morrer, a mochila fica no local da morte para ser recuperada.

## Androides inimigos (low-poly)

Visual baseado na folha de referência: metal grafite facetado, frisos dourados luminosos e olhos âmbar ou vermelhos. O sombreamento é facetado e nítido, sem suavização.

| Androide | Rig | Comportamento |
|---|---|---|
| Androide soldado | humanoide | Arma no antebraço; mantém distância e atira |
| Androide caçador | humanoide | Fuzil e lâminas; atira e luta de perto |
| Titã-gorila | humanoide grande | Postura de gorila, punhos enormes, luz laranja no peito, canhão no braço |
| Rinoceronte blindado | quadrúpede | Ruge e dispara míssil teleguiado do chifre; depois persegue e faz investidas |
| Tigre-canhão | quadrúpede | Ruge, gira a metralhadora das costas e dispara até superaquecer (vermelha); depois corre para morder |
| Aranha mecânica | 8 patas | Olhos vermelhos, rápida, em grupos |
| Aranha-radar | 8 patas + 2 antenas parabólicas | Sentinela: alerta androides num raio de 70 m |
| Aranha-tanque | 8 patas + torre | Grande e lenta, atira com o canhão da torre |
| Escorpião mecânico | 8 patas + pinças + cauda | Corpo a corpo com pinças e ferrão |
| Formiga mecânica | 6 patas | Corpo a corpo |
| Besouro-hércules | 6 patas | Chifre curvo, carapaça blindada, investidas |
| Libélula de ataque | voadora | Asas azuis; voa em órbita e mergulha |
| Libélula-sentinela | voadora | Alerta os outros androides |
| Abelha robótica | voadora | Vive em colmeias; só ataca perto da colmeia ou se você pegar o mel |
| Corvo mecânico, Águia de aço | ave | Atacam em mergulho |

Voadores só podem ser atingidos durante o mergulho (a lança tem mais alcance). Defender vira o personagem para o inimigo mais próximo e reduz 80% do dano. O jogo é feito para PC; os controles de toque só aparecem em telas sensíveis ao toque.

## Salvamento

O jogo salva automaticamente a cada 60 s, ao dormir, ao trocar de aba e ao fechar a página. Também dá para salvar pelo menu de pausa. O salvamento guarda:

- Posição, atributos, inventário e equipamento.
- Hora, dia e clima.
- Construções, incluindo o conteúdo dos baús e o estado das portas e fogueiras.
- Árvores cortadas, rochas mineradas, arbustos e coletáveis usados, com o tempo de regeneração de cada um.
- Itens no chão e troncos.

Tudo fica no `localStorage` do navegador: o progresso existe só naquele navegador e naquele dispositivo.

## Realismo: o que é real e o que é aproximação

Tudo é gerado por código, sem arquivos externos. Isso significa:

- **Feito de verdade**: iluminação PBR, HDR, sombras suaves, SSAO, bloom, névoa de altura, materiais com micro-detalhe procedural, folhagem com recorte alfa e translucidez, armas com balística hitscan, dano por região, recuo e recarga, sangramento, veneno, temperatura corporal, roupas, mochilas, colete, sítios exploráveis com loot próprio e IA tática.
- **Aproximações**: os modelos são geométricos, sem escultura de alta resolução nem texturas fotográficas. O detalhe de superfície (poros, trama, riscos) é ruído procedural. As animações são keyframes escritos à mão, sem captura de movimento. Os sons são sintetizados.
- **O que falta para um visual equivalente a SCUM/DayZ**, e onde encaixar:
  - modelos GLB esculpidos com mapas PBR (albedo, normal, rugosidade/metal, AO): personagem, androides e armas → `assets/models/` + `models.json` (o carregador `engine/gltf.js` já aceita skin, animações e textura base);
  - animações de captura de movimento (andar armado, recarregar, mirar): podem vir no mesmo GLB, pelos nomes de clipe já mapeados;
  - texturas de terreno e vegetação fotográficas: substituiriam o atlas de `game/textures.js`;
  - sons gravados de armas e ambiente: substituiriam os casos em `game/audio.js`.

## Recursos provisórios (substituíveis)

- **Modelos 3D**: personagens, androides, animais, árvores e construções são malhas low-poly procedurais, inspiradas nas artes de referência (não são cópias exatas). Os personagens têm esqueleto e skinning reais. Não há modelos artísticos definitivos.
- **Animações**: as poses-chave foram escritas à mão e convertidas em clipes keyframe de esqueleto. Não vêm de captura de movimento.
- **Áudio**: todo sintetizado em tempo real, sem arquivos de som gravados.
- **Ícones da interface**: emojis do sistema, cuja aparência varia conforme o sistema operacional.

### Trocar o personagem por um modelo definitivo (GLB)

1. Coloque o arquivo em `assets/models/` (por exemplo `player.glb`).
2. Em `assets/models/models.json`, defina `"player": "player.glb"`.
3. O arquivo precisa ter skin (até 32 ossos) e animações. Os nomes são reconhecidos sem diferenciar maiúsculas, e há apelidos estilo Mixamo:
   `idle, walk, run, sprint, jump, fall, land, crouchIdle, crouchWalk, turn, swim, swimIdle, climb, pickup, use, chop, mine, punch, punchL, thrust, block, hit, die, sleep`.
   Animações ausentes usam uma equivalente (por exemplo, `sprint` → `run`).
4. É preciso existir um osso de mão direita (`handR`, `RightHand`, `mixamorig:RightHand`…), onde as ferramentas são presas. A altura é normalizada para 1,8 m.

`assets/models/reference_player.glb` é o personagem atual exportado por `node tools/export_glb.mjs`. Ele serve de referência de escala, nomes e estrutura, e foi usado para validar o carregador.

## Testes

Com o servidor rodando em `localhost:8765`:

```bash
python3 tests/play.py    # 36 verificações: movimento, sprint, pulo, agachar, câmera, coleta, fabricação,
                         # corte, construção, validação de recursos, combate, salvar/carregar, morte, pausa
python3 tests/play2.py   # 33 verificações: água/natação, comer/cozinhar, mineração, arbustos, limite do
                         # inventário, baú, porta, dormir, escalada, IA (patrulha/detecção/ataque/fuga),
                         # defesa, fome/sede, controles de toque
python3 tests/play3.py   # 13 verificações: os 14 androides, tiro, voo/mergulho, investida, alarme, saque, lança de choque
python3 tests/play4.py   # 16 verificações: rinoceronte (rugido + míssil), tigre (giro, rajada, superaquecimento, mordida), abelhas e colmeias
python3 tests/play20.py  # 22 verificações: rodovia central e ramais (asfalto/terra), cidades em grade, casas de frente
                         # para a rua, lagos/rios/cachoeiras, água contaminada, coletor de chuva, composteira e adubo
python3 tests/play21.py  # 33 verificações: bifes, cidades grandes, tosse/infecção, escadas, barulho, barra 1-2/3/4-8,
                         # NPCs (acampamentos, militares, briga com robôs, picotar) e as 4 granadas de mão
python3 tests/play25.py  # 19 verificações: projeto (roda com 11 peças, encaixes, animação), bandeira (área), martelo (reparar, upar até metal, girar, demolir com metade), peças sem apoio caem, explosão, salvar
python3 tests/play29.py  # 5 verificações: área Próximo no inventário (pegar e pegar tudo) e lupa nos móveis com loot
python3 tests/play30.py  # 7 verificações: arma grande direto para as costas, Verificar (pente/mira/silenciador), sem pente não atira, silenciador
python3 tests/play31.py  # 10 verificações: helicóptero (som, voo, circula e atira, fumaça esconde, tripulação NPC, tiro no piloto, atirador cai, queda, caixas, fumaça)
python3 tests/play34.py  # 6 verificações: tênis no começo, mochila maior veste sozinha, bateria e roupa perguntam onde equipar, cortar em retalhos
python3 tests/play33.py  # 9 verificações: voz (CAPS LOCK, ícone pisca, NPC/robô vêm, voz de outro jogador), botões VOZ e bala no celular
python3 tests/play32.py  # 12 verificações: Modificar controles (Cancelar/Salvar), PAUSA + trava de corrida no joystick + celular (só no celular, joystick, câmera, botões, mochila, engrenagem arrasta/tamanho salvo, aviso de girar)
python3 tests/play28.py  # 9 verificações: quantidade no slot, fragmentação (fogo, clarão, cratera), luz (4 s + embaçado), fumaça densa 15 s, barulhenta, C4 (20 m) e dano nas construções
python3 tests/play27.py  # 14 verificações: painel do dono (Ctrl+Shift+F1): dropar itens/NPCs/robôs/animais, lista, modo deus, voar, esqueletos, teleporte, console
python3 tests/play26.py  # 20 verificações: multiplayer com dois navegadores (o teste liga o server.mjs sozinho): busca por IP, senha, avatares, mundo, criaturas, PvP
python3 tests/play23.py  # 9 verificações: granada (F puxa o pino, barra de força verde/amarelo/vermelho, braço erguido, arremesso perto/médio/longe), mochila nas costas
python3 tests/play24.py  # 8 verificações: braços humanos dos NPCs, bases (30 soldados + mecha), base tóxica só robôs, patrulhas, acampamentos, sinal de fumaça e brilho, carregador nas alças
python3 tests/play22.py  # 33 verificações: comboio (formação, armadilha, tiro, fuga, base), fogueira (combustível, grelha,
                         # carvão/cinza, queimar, pegar mirando, sem duplicar), kuru, vômito, desmaio/finalização, flash
python3 tests/shots.py   # capturas de tela de várias cenas
```

Os testes usam Playwright com renderização por software (SwiftShader) e avançam a simulação de forma determinística com `__game.debugStep()`.
