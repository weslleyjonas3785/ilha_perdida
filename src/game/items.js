// Itens, receitas de fabricação/construção e inventário com capacidade limitada.
export const ITEMS = {
  wood: { name: 'Madeira', icon: '🪵', stack: 40, type: 'resource', desc: 'Obtida derrubando árvores.' },
  sand: { name: 'Areia', icon: '🟫', stack: 60, type: 'resource', kg: 0.3, desc: 'Cavada do chão com a picareta. Cave buracos fundos para fazer uma base embaixo da terra.' },
  stone: { name: 'Pedra', icon: '🪨', stack: 40, type: 'resource', desc: 'Coletada no chão ou minerando rochas.' },
  stick: { name: 'Galho', icon: '🥢', stack: 40, type: 'resource', desc: 'Galhos secos encontrados na floresta.' },
  leaf: { name: 'Folhas', icon: '🍃', stack: 50, type: 'resource', desc: 'Folhagem de arbustos e árvores.' },
  fiber: { name: 'Fibra vegetal', icon: '🌾', stack: 50, type: 'resource', desc: 'Usada para amarrar e costurar.' },
  scrap: { name: 'Sucata', icon: '🔩', stack: 30, type: 'resource', desc: 'Metal recuperado das ruínas.' },
  cloth: { name: 'Pano', icon: '🧵', stack: 30, type: 'resource', desc: 'Tecido velho das ruínas.' },
  circuit: { name: 'Circuito', icon: '🔌', stack: 30, type: 'resource', desc: 'Placa recuperada de androides destruídos.' },
  core: { name: 'Núcleo de energia', icon: '🔋', stack: 10, type: 'resource', desc: 'Fonte de energia dos androides grandes.' },
  crystal: { name: 'Cristal', icon: '💎', stack: 20, type: 'resource', desc: 'Cristal luminoso das cavernas.' },
  berry: { name: 'Frutas', icon: '🫐', stack: 20, type: 'food', food: 12, water: 4, desc: 'Frutas silvestres. +12 fome, +4 sede.' },
  mushroom: { name: 'Cogumelo', icon: '🍄', stack: 20, type: 'food', food: 8, desc: 'Comestível cru. Melhor assado.' },
  meat: { name: 'Carne crua', icon: '🥩', stack: 10, type: 'food', food: 14, risk: 0.45, desc: 'Comer crua pode intoxicar. Asse na fogueira.' },
  meat_cow: { name: 'Carne de vaca', icon: '🥩', img: 'meat_cow', stack: 10, type: 'food', food: 16, risk: 0.45, desc: 'Bife cru de vaca. Comer cru pode intoxicar — asse na fogueira.' },
  meat_boar: { name: 'Carne de javali', icon: '🥩', img: 'meat_boar', stack: 10, type: 'food', food: 14, risk: 0.5, desc: 'Carne crua de javali, escura e marmorizada. Asse na fogueira.' },
  meat_chicken: { name: 'Carne de galinha', icon: '🍗', img: 'meat_chicken', stack: 10, type: 'food', food: 9, risk: 0.6, desc: 'Peito de galinha cru — alto risco de intoxicação. Asse na fogueira.' },
  meat_deer: { name: 'Carne de cervo', icon: '🥩', img: 'meat_deer', stack: 10, type: 'food', food: 14, risk: 0.4, desc: 'Carne magra de cervo, crua. Asse na fogueira.' },
  meat_human: { name: 'Carne humana', icon: '🥩', img: 'meat_human', stack: 10, type: 'food', human: true, food: 14, risk: 0.85, riskMsg: '🤢 Comer carne humana crua te deixou doente!', desc: 'Retirada de um corpo picotado. Muito arriscado comer — mesmo assada pode causar doença.' },
  cooked_cow: { name: 'Bife de vaca assado', icon: '🍖', img: 'cooked_cow', stack: 10, type: 'food', food: 42, heal: 6, desc: 'Bife assado na fogueira. +42 fome.' },
  cooked_boar: { name: 'Javali assado', icon: '🍖', img: 'cooked_boar', stack: 10, type: 'food', food: 40, heal: 6, desc: 'Carne de javali assada. +40 fome.' },
  cooked_chicken: { name: 'Galinha assada', icon: '🍗', img: 'cooked_chicken', stack: 10, type: 'food', food: 26, heal: 4, desc: 'Peito de galinha assado. +26 fome.' },
  cooked_deer: { name: 'Cervo assado', icon: '🍖', img: 'cooked_deer', stack: 10, type: 'food', food: 38, heal: 8, desc: 'Carne de cervo assada. +38 fome, cura 8.' },
  cooked_human: { name: 'Carne humana assada', icon: '🍖', img: 'cooked_human', stack: 10, type: 'food', human: true, food: 30, risk: 0.35, riskMsg: '🤢 A carne humana te fez mal, mesmo assada!', desc: 'Mata a fome, mas pode deixar doente.' },
  bone: { name: 'Osso', icon: '🦴', stack: 30, type: 'resource', kg: 0.25, desc: 'Osso de um corpo picotado.' },
  burnt_cow: { name: 'Bife de vaca queimado', icon: '🥩', img: 'burnt_cow', stack: 10, type: 'food', food: 12, burnt: true, desc: 'Passou do ponto na fogueira. Comer pode fazer mal depois de uns minutos.' },
  burnt_boar: { name: 'Javali queimado', icon: '🥩', img: 'burnt_boar', stack: 10, type: 'food', food: 12, burnt: true, desc: 'Passou do ponto na fogueira. Comer pode fazer mal depois de uns minutos.' },
  burnt_chicken: { name: 'Galinha queimada', icon: '🍗', img: 'burnt_chicken', stack: 10, type: 'food', food: 8, burnt: true, desc: 'Passou do ponto na fogueira. Comer pode fazer mal depois de uns minutos.' },
  burnt_deer: { name: 'Cervo queimado', icon: '🥩', img: 'burnt_deer', stack: 10, type: 'food', food: 11, burnt: true, desc: 'Passou do ponto na fogueira. Comer pode fazer mal depois de uns minutos.' },
  burnt_human: { name: 'Carne humana queimada', icon: '🥩', img: 'burnt_human', stack: 10, type: 'food', food: 10, burnt: true, human: true, desc: 'Passou do ponto na fogueira. Comer pode fazer mal — e é carne humana.' },
  burnt_meat: { name: 'Carne queimada', icon: '🥩', img: 'burnt_cow', stack: 10, type: 'food', food: 10, burnt: true, desc: 'Passou do ponto na fogueira. Comer pode fazer mal depois de uns minutos.' },
  charcoal: { name: 'Carvão', icon: '⚫', stack: 30, type: 'resource', kg: 0.2, desc: 'Sobra da lenha queimada na fogueira. É um combustível que dura mais que a madeira (e vira cinza).' },
  ash: { name: 'Cinza', icon: '🩶', stack: 50, type: 'resource', kg: 0.1, desc: 'Sobra do carvão queimado na fogueira.' },
  cookedmeat: { name: 'Carne assada', icon: '🍖', stack: 10, type: 'food', food: 38, heal: 6, desc: 'Muito nutritiva. +38 fome.' },
  cookedmush: { name: 'Cogumelo assado', icon: '🍢', stack: 20, type: 'food', food: 16, heal: 2, desc: '+16 fome.' },
  honey: { name: 'Mel', icon: '🍯', stack: 10, type: 'food', food: 20, water: 6, heal: 5, desc: 'Mel das colmeias robóticas. +20 fome, cura 5.' },
  canned: { name: 'Comida enlatada', icon: '🥫', stack: 10, type: 'food', food: 30, water: 5, desc: 'Encontrada nas ruínas.' },
  tire: { name: 'Pneu de carro', icon: '🛞', stack: 4, type: 'part', kg: 9, desc: 'Pneu com roda para carros (picape, sedã, hatch, SUV). Abra o menu do veículo (E) e arraste para a roda.' },
  mototire: { name: 'Pneu de moto', icon: '🛞', stack: 2, type: 'part', kg: 5, desc: 'Pneu com roda para a moto.' },
  engine: { name: 'Motor de carro', icon: '⚙️', stack: 1, type: 'part', kg: 32, desc: 'Motor para carros. Pesado! Leve até o carro e instale pelo menu do veículo (E).' },
  motoengine: { name: 'Motor de moto', icon: '⚙️', stack: 1, type: 'part', kg: 14, desc: 'Motor para a moto. Instale pelo menu do veículo (E).' },
  gearbox: { name: 'Câmbio (engrenagens)', icon: '🔩', stack: 1, type: 'part', kg: 8, desc: 'Caixa de engrenagens: a moto precisa de uma (os carros já vêm com câmbio).' },
  jerrycan: { name: 'Galão de combustível', icon: '⛽', stack: 1, type: 'tool', tool: 'jerry', kg: 1.5, desc: 'Leva até 20 L. Na mão, perto de um veículo: E abastece, F retira combustível. Nas bombas dos postos: E enche o galão.' },
  soro: { name: 'Soro de reidratação', icon: '🧃', stack: 5, type: 'drink', water: 60, heal: 10, desc: 'Água com mel e cinzas: +60 sede e +10 de vida. Bom contra a desidratação do deserto.' },
  water: { name: 'Água potável', icon: '💧', stack: 10, type: 'drink', water: 35, desc: 'Garrafa de água potável (fervida, da chuva ou lacrada). +35 sede.' },
  dirtywater: { name: 'Água suja', icon: '🫗', stack: 10, type: 'drink', water: 30, risk: 0.55, riskMsg: '🤢 A água estava contaminada — infecção intestinal! Ferva a água na fogueira.', desc: 'Toda água de rio, lago, riacho ou mar é contaminada. Ferva na fogueira para virar água potável. Beber assim pode causar infecção.' },
  dirt: { name: 'Terra', icon: '🟤', stack: 60, type: 'resource', kg: 0.35, desc: 'Cavada do chão com a picareta (fora do deserto). Vai na composteira e nos canteiros.' },
  adubo: { name: 'Adubo', icon: '🌿', stack: 20, type: 'resource', kg: 0.4, desc: 'Composto pronto da composteira. Use num canteiro (E) para as frutas crescerem no dobro da velocidade e renderem mais.' },
  bandage: { name: 'Bandagem', icon: '🩹', stack: 10, type: 'medical', heal: 25, cure: ['bleed'], desc: 'Estanca sangramento e recupera 25 de vida.' },
  medkit: { name: 'Kit médico', icon: '💊', stack: 5, type: 'medical', heal: 60, cure: ['bleed', 'poison'], desc: 'Cura sangramento e veneno, recupera 60 de vida.' },
  blueprint: { name: 'Projeto', icon: '📜', stack: 1, type: 'tool', tool: 'blueprint', kg: 0.1, desc: 'Na mão: segure o botão direito para escolher a peça (fundação, parede, telhado…) e clique para construir. Só dentro da área da sua Bandeira de território.' },
  hammer: { name: 'Martelo de madeira', icon: '🔨', stack: 1, type: 'tool', tool: 'hammer', kg: 0.6, desc: 'Na mão, olhando para a construção: botão esquerdo repara; segure o direito para Upar (galhos → madeira → pedra → metal), Mudar posição ou Demolir (devolve metade).' },
  axe: { name: 'Machado de pedra', icon: '🪓', stack: 1, type: 'tool', tool: 'axe', dmg: 15, chop: 1, reach: 2.0, desc: 'Corta árvores. Dano 15.' },
  scrapaxe: { name: 'Machado de sucata', icon: '⚒️', stack: 1, type: 'tool', tool: 'axe', dmg: 24, chop: 2, mine: 1, reach: 2.1, desc: 'Corta rápido e minera um pouco. Dano 24.' },
  pickaxe: { name: 'Picareta de pedra', icon: '⛏️', stack: 1, type: 'tool', tool: 'pickaxe', dmg: 12, mine: 1, reach: 2.0, desc: 'Minera rochas. Dano 12.' },
  knife: { name: 'Faca de pedra', icon: '🔪', stack: 1, type: 'tool', tool: 'knife', dmg: 13, reach: 1.6, desc: 'Arma branca rápida. Dano 13. Botão direito defende golpes.' },
  scrapknife: { name: 'Faca de sucata', icon: '🔪', stack: 1, type: 'tool', tool: 'knife', dmg: 22, reach: 1.7, desc: 'Lâmina de metal afiada. Dano 22. Botão direito defende golpes.' },
  spear: { name: 'Lança', icon: '🔱', stack: 1, type: 'tool', tool: 'spear', dmg: 22, reach: 2.8, desc: 'Longo alcance. Dano 22.' },
  scrapspear: { name: 'Lança reforçada', icon: '🗡️', stack: 1, type: 'tool', tool: 'spear', dmg: 34, reach: 3.0, desc: 'Ponta de metal. Dano 34.' },
  torch: { name: 'Tocha', icon: '🔥', stack: 1, type: 'tool', tool: 'torch', dmg: 8, reach: 1.8, desc: 'Ilumina a noite e cavernas.' },
  shockspear: { name: 'Lança de choque', icon: '⚡', stack: 1, type: 'tool', tool: 'spear', dmg: 50, reach: 3.0, desc: 'Ponta energizada: dano 50, ideal contra androides.' },
  // armas de fogo (munição separada; o carregador de cada arma é guardado em game.guns.mags)
  pistol35: { name: 'Pistola .35', icon: '🔫', stack: 1, type: 'tool', tool: 'gun', dmg: 5, reach: 1.5, desc: 'Compacta, 15 tiros, pouco recuo. Munição .35. Não aceita luneta. Botão direito: mirar.' },
  pistol: { name: 'Pistola .42', icon: '🔫', stack: 1, type: 'tool', tool: 'gun', dmg: 6, reach: 1.5, desc: 'Semiautomática, 12 tiros. Munição .42. Não aceita luneta. Botão direito: mirar.' },
  pistol65: { name: 'Pistola .65 Magnum', icon: '🔫', stack: 1, type: 'tool', tool: 'gun', dmg: 7, reach: 1.5, desc: '7 tiros pesados, recuo forte, dano alto. Munição .65. Não aceita luneta.' },
  shotgun: { name: 'Escopeta', icon: '💥', stack: 1, type: 'tool', tool: 'gun', dmg: 8, reach: 1.6, desc: '6 cartuchos, 9 balins por tiro. Devastadora a curta distância. Não aceita luneta.' },
  rifle540: { name: 'Fuzil de assalto 5.40', icon: '🎯', stack: 1, type: 'tool', tool: 'gun', dmg: 8, reach: 1.6, desc: 'Automático, 30 tiros, rápido e controlável. Munição 5.40. Aceita luneta 4x.' },
  rifle: { name: 'Fuzil de assalto 5.55', icon: '🎯', stack: 1, type: 'tool', tool: 'gun', dmg: 8, reach: 1.6, desc: 'Automático, 30 tiros. Munição 5.55. Aceita luneta 4x.' },
  rifle577: { name: 'Fuzil de assalto 5.77', icon: '🎯', stack: 1, type: 'tool', tool: 'gun', dmg: 8, reach: 1.6, desc: 'Automático, 25 tiros, o mais forte dos fuzis de assalto. Munição 5.77. Aceita luneta 4x.' },
  sniper745: { name: 'Fuzil de precisão 7.45', icon: '🔭', stack: 1, type: 'tool', tool: 'gun', dmg: 8, reach: 1.6, desc: 'Ferrolho, 5 tiros. Munição 7.45. Aceita lunetas 4x e 8x.' },
  sniper: { name: 'Fuzil de precisão 7.69', icon: '🔭', stack: 1, type: 'tool', tool: 'gun', dmg: 8, reach: 1.6, desc: 'Ferrolho, 5 tiros. Munição 7.69. Aceita lunetas 4x e 8x.' },
  sniper790: { name: 'Fuzil de precisão 7.90', icon: '🔭', stack: 1, type: 'tool', tool: 'gun', dmg: 8, reach: 1.6, desc: 'Ferrolho, 4 tiros, o mais potente. Munição 7.90. Aceita lunetas 4x e 8x.' },
  scope4: { name: 'Luneta 4x', icon: '🔍', stack: 1, type: 'attachment', desc: 'Encaixa em fuzis de assalto e de precisão. Use com a arma na mão para encaixar. Roda do mouse: 3x–5x.' },
  scope8: { name: 'Luneta 8x', icon: '🔎', stack: 1, type: 'attachment', desc: 'Só para fuzis de precisão. Use com a arma na mão para encaixar. Roda do mouse: 6x–10x.' },
  ammo35: { name: 'Munição .35', icon: '•', stack: 60, type: 'ammo', desc: 'Para a pistola .35.' },
  ammo42: { name: 'Munição .42', icon: '•', stack: 60, type: 'ammo', desc: 'Para a pistola .42.' },
  ammo65: { name: 'Munição .65', icon: '•', stack: 40, type: 'ammo', desc: 'Para a pistola .65 Magnum.' },
  ammo540: { name: 'Munição 5.40', icon: '⁍', stack: 90, type: 'ammo', desc: 'Para o fuzil de assalto 5.40.' },
  ammo555: { name: 'Munição 5.55', icon: '⁍', stack: 90, type: 'ammo', desc: 'Para o fuzil de assalto 5.55.' },
  ammo577: { name: 'Munição 5.77', icon: '⁍', stack: 90, type: 'ammo', desc: 'Para o fuzil de assalto 5.77.' },
  ammo745: { name: 'Munição 7.45', icon: '⁌', stack: 40, type: 'ammo', desc: 'Para o fuzil de precisão 7.45.' },
  ammo769: { name: 'Munição 7.69', icon: '⁌', stack: 40, type: 'ammo', desc: 'Para o fuzil de precisão 7.69.' },
  ammo790: { name: 'Munição 7.90', icon: '⁌', stack: 40, type: 'ammo', desc: 'Para o fuzil de precisão 7.90.' },
  solarlamp: { name: 'Lanterna solar', icon: '🔦', stack: 1, type: 'tool', tool: 'torch', light: true, dmg: 4, reach: 1.4, desc: 'Ilumina como a tocha, mas não apaga com chuva nem se gasta: recarrega com a placa solar.' },
  iron: { name: 'Barra de ferro', icon: '🧱', stack: 20, type: 'resource', desc: 'Ferro fundido a partir de sucata (fogueira) ou achado em carros, galpões e bases.' },
  filament: { name: 'Filamento', img: 'filament', icon: '🧵', stack: 10, type: 'resource', desc: 'Carretel de filamento plástico para a impressora 3D. Achado em casas, indústrias e laboratórios.' },
  gunparts: { name: 'Peças de armas', icon: '⚙️', stack: 10, type: 'resource', desc: 'Molas, gatilhos e mecanismos impressos na impressora 3D. Usadas no arpão e em lunetas.' },
  copperwire: { name: 'Fio de cobre', icon: '〰️', stack: 40, type: 'resource', desc: 'Liga aparelhos elétricos. Cada rolo cobre 5 m de distância. Use na impressora/painel/fontes: "Puxar fio".' },
  harpoon: { name: 'Arpão-gancho', img: 'harpoon', icon: '🔱', stack: 1, type: 'tool', tool: 'gun', dmg: 6, reach: 1.5, desc: 'Só pode ser fabricado na impressora 3D. Dispara um arpão com corda que gruda e puxa você até o ponto. Mira verde = alcança, vermelha = longe demais (40 m). Botão direito: mirar.' },
  nvg: { name: 'Óculos de visão noturna', icon: '🥽', img: 'nvg', stack: 1, type: 'clothing', slot: 'hat', dur: 99999, nvg: true, kg: 0.6, desc: 'Vista no lugar do chapéu. Arraste uma bateria de célula sobre ele para anexar; liga/desliga com N. Clique direito nele para tirar a bateria. Encontrado só em áreas militares.' },
  nvcell: { name: 'Bateria de célula', icon: '🔋', img: 'nvcell', stack: 4, type: 'misc', kg: 0.05, desc: 'Pequena célula de energia. Arraste sobre o óculos de visão noturna para anexar (dura cerca de uma noite ligada). Achada em casas nas cidades.' },
  nvcell_dead: { name: 'Bateria descarregada', icon: '🪫', img: 'nvcell_dead', stack: 8, type: 'misc', kg: 0.05, desc: 'Célula sem carga. Não serve mais para o óculos.' },
  hg_frag: { name: 'Granada de fragmentação', icon: '💣', img: 'hg_frag', stack: 5, type: 'tool', tool: 'grenade', kg: 0.4, desc: 'F puxa o pino (na mão explode em 5 s); segure o botão esquerdo para escolher a força e solte para jogar. Explode 5 s depois de puxar o pino: mata ou fere muito dependendo da distância (jogadores, NPCs e robôs).' },
  hg_flash: { name: 'Granada de luz (flash)', icon: '💥', img: 'hg_flash', stack: 5, type: 'tool', tool: 'grenade', kg: 0.3, desc: 'F puxa o pino; segure e solte o botão esquerdo para jogar. Ativa 3 s depois de jogada: clarão que cega por 4 s (tela branca e zumbido); NPCs cobrem o rosto com o braço e robôs perdem o alvo.' },
  hg_smoke: { name: 'Granada de fumaça', icon: '🌫️', img: 'hg_smoke', stack: 5, type: 'tool', tool: 'grenade', kg: 0.35, desc: 'F puxa o pino; segure e solte o botão esquerdo para jogar. Ativa 3 s depois de jogada e solta fumaça aos poucos: dentro dela os robôs não te veem; os NPCs ficam em alerta e só atiram se te virem.' },
  hg_horn: { name: 'Granada barulhenta', icon: '📯', img: 'hg_horn', stack: 5, type: 'tool', tool: 'grenade', kg: 0.35, desc: 'F puxa o pino; segure e solte o botão esquerdo para jogar: toca uma buzina alta. Robôs por perto vão até ela atirando para destruí-la; NPCs na direção em que você jogou te veem e vêm atrás.' },
  c4: { name: 'C4', icon: '🧨', stack: 5, type: 'tool', tool: 'c4', kg: 1.0, dmg: 4, reach: 1.2, desc: 'Explosivo com cronômetro de 10 s. Na mão mostra onde vai ficar: verde = dá para colocar (até 3,5 m, em chão, parede, objeto ou inimigo), vermelho = não dá. Clique para armar. Destrói construções e mata quase tudo no raio.' },
  geiger: { name: 'Contador Geiger', img: 'geiger', icon: '📟', stack: 1, type: 'tool', tool: 'geiger', dmg: 2, reach: 1.2, desc: 'Na mão, aponte para as coisas: a barra mostra quanta radiação vem daquela direção (zona tóxica, itens e caixas contaminados). Botão direito: apontar com precisão. Achado em laboratórios e bases militares, ou impresso na impressora 3D.' },
  harpoonammo: { name: 'Munição de arpão', img: 'harpoonammo', icon: '🪝', stack: 6, type: 'ammo', desc: 'Arpão de ferro com corda. Cada uma dá 3 disparos.' },
  printer3d: { name: 'Impressora 3D', img: 'printer3d', icon: '🖨️', stack: 1, type: 'machine', place: 'printer', desc: 'Imprime peças de armas, o arpão e lunetas usando filamento e energia. Posicione no chão e ligue a um painel com fio de cobre.' },
  epanel: { name: 'Painel elétrico', icon: '🎛️', stack: 2, type: 'machine', place: 'panel', desc: 'Centro da rede elétrica: ligue aparelhos, fontes de energia e baterias nele.' },
  windkit: { name: 'Turbina eólica (kit)', icon: '🌬️', stack: 1, type: 'machine', place: 'wind', desc: 'Gera energia com o vento (mais no alto e com tempestade).' },
  wheelkit: { name: 'Roda d’água (kit)', icon: '🛞', stack: 1, type: 'machine', place: 'waterwheel', desc: 'Gera energia constante. Precisa ficar na beira de um rio ou lago de água doce.' },
  battery: { name: 'Bateria', icon: '🔋', stack: 4, type: 'machine', place: 'battery', desc: 'Guarda energia das fontes para usar à noite ou sem vento.' },
  solarpanel: { name: 'Placa solar', img: 'solarpanel', icon: '🔷', stack: 10, type: 'resource', place: 'solar', desc: 'Painel em forma de asa, retirado de uma borboleta solar. Usado em lanternas ou posicionado como fonte de energia solar (requer 2 sucatas).' },
  leather: { name: 'Couro', icon: '🟫', stack: 20, type: 'resource', desc: 'Pele de cervo ou javali. Usada em roupas e mochilas.' },
  cord: { name: 'Corda de fibra', icon: '🪢', stack: 20, type: 'resource', desc: 'Fibras trançadas. Usada no arco e em amarrações.' },
  bow: { name: 'Arco', icon: '🏹', stack: 1, type: 'tool', tool: 'gun', dmg: 5, reach: 1.5, desc: 'Arma silenciosa de longo alcance. Botão direito mira; a flecha cai com a distância.' },
  arrow: { name: 'Flecha', icon: '➶', stack: 30, type: 'ammo', desc: 'Ponta de pedra. Pode ser recolhida depois do disparo.' },
  gl: { name: 'Lança-granadas improvisado', icon: '💣', img: 'gl', stack: 1, type: 'tool', tool: 'gun', dmg: 8, reach: 1.6, kg: 4.5, desc: 'Feito de sucata, vergalhão e trapos — só dá para fabricar. Tiro único em arco. T troca a munição: amarela (fragmentação), verde (gás tóxico), cinza (fumaça). 14 granadas derrubam um mecha.' },
  rpg: { name: 'Lança-foguetes', icon: '🚀', img: 'rpg', stack: 1, type: 'tool', tool: 'gun', dmg: 8, reach: 1.6, kg: 6.5, desc: 'Arma antitanque: 2 foguetes derrubam um mecha. Só é achado na área militar da zona tóxica.' },
  rocket: { name: 'Foguete', icon: '🚀', img: 'rocket', stack: 4, type: 'ammo', kg: 2.2, desc: 'Munição do lança-foguetes. Só cai de robôs dentro da zona tóxica (raramente).' },
  gren_he: { name: 'Granada de fragmentação (amarela)', icon: '🟡', img: 'gren_he', stack: 8, type: 'ammo', kg: 0.25, desc: 'Explode no impacto espalhando estilhaços. Achada só em bases militares.' },
  gren_gas: { name: 'Granada de gás tóxico (verde)', icon: '🟢', img: 'gren_gas', stack: 8, type: 'ammo', kg: 0.25, desc: 'Solta uma nuvem de gás que envenena por alguns segundos. Achada só em bases militares.' },
  gren_smoke: { name: 'Granada de fumaça (cinza)', icon: '⚪', img: 'gren_smoke', stack: 8, type: 'ammo', kg: 0.25, desc: 'Cortina de fumaça: inimigos não enxergam através dela. Achada só em bases militares.' },
  shells: { name: 'Cartuchos de escopeta', icon: '▮', stack: 30, type: 'ammo', desc: 'Para a escopeta.' },
  barkarmor: { name: 'Armadura de casca', icon: '🦺', stack: 1, type: 'clothing', slot: 'vest', armor: 0.2, warm: 2.5, dur: 300, desc: 'Colete de casca: reduz 20% do dano e protege do frio.' },
  scraparmor: { name: 'Armadura de sucata', icon: '🛡️', stack: 1, type: 'clothing', slot: 'vest', armor: 0.4, warm: 1, dur: 500, desc: 'Colete de sucata: reduz 40% do dano recebido.' },
  vest: { name: 'Colete tático militar', icon: '🥋', stack: 1, type: 'clothing', slot: 'vest', mil: true, armor: 0.5, warm: 1.5, pockets: [4, 3], dur: 1500, desc: 'Placas militares: reduz 50% do dano e tem 12 bolsos. Encontrado em bases militares.' },
  parka: { name: 'Jaqueta acolchoada', icon: '🧥', stack: 1, type: 'clothing', slot: 'shirt', armor: 0.08, warm: 7, pockets: [3, 2], dur: 900, desc: 'Mantém o corpo aquecido à noite e na chuva. 6 bolsos.' },
  rags_shirt: { name: 'Camiseta velha', icon: '👕', stack: 1, type: 'clothing', slot: 'shirt', warm: 0.5, dur: 5400, life: 5400, desc: 'A roupa com que você acordou. Sem bolsos e vai se desgastando com o tempo — faça roupas novas.' },
  rags_pants: { name: 'Calça velha', icon: '👖', stack: 1, type: 'clothing', slot: 'pants', warm: 0.5, dur: 5400, life: 5400, desc: 'A calça com que você acordou. Sem bolsos e vai se desgastando com o tempo — faça roupas novas.' },
  shirt: { name: 'Blusa de pano', icon: '👕', stack: 1, type: 'clothing', slot: 'shirt', warm: 1.5, pockets: [5, 1], dur: 700, desc: 'Costurada à mão: 5 bolsos.' },
  pants: { name: 'Calça de pano', icon: '👖', stack: 1, type: 'clothing', slot: 'pants', warm: 1, pockets: [5, 1], dur: 700, desc: 'Costurada à mão: 5 bolsos.' },
  clothvest: { name: 'Colete de pano', icon: '🦺', stack: 1, type: 'clothing', slot: 'vest', armor: 0.06, warm: 1, pockets: [5, 1], dur: 600, desc: 'Colete simples: 5 bolsos.' },
  hat: { name: 'Chapéu de palha', icon: '👒', stack: 1, type: 'clothing', slot: 'hat', warm: 0.5, sun: true, dur: 800, desc: 'Protege do sol forte (menos sede no deserto).' },
  fibergloves: { name: 'Luvas de fibra', icon: '🧤', stack: 1, type: 'clothing', slot: 'gloves', dur: 120, desc: 'Protegem as mãos ao cortar, minerar e socar. Desgastam com o uso (120 golpes).' },
  rags_shoes: { name: 'Sapatos velhos', icon: '👞', stack: 1, type: 'clothing', slot: 'shoes', dur: 6000, desc: 'Os sapatos com que você acordou. Desgastam andando (≈6 km) — depois faça sapatos de fibra ou botas de couro.' },
  fibershoes: { name: 'Sapatos de fibra', icon: '🥿', stack: 1, type: 'clothing', slot: 'shoes', dur: 1500, desc: 'Protegem os pés. Desgastam andando (≈1,5 km).' },
  leathergloves: { name: 'Luvas de couro', icon: '🧤', stack: 1, type: 'clothing', slot: 'gloves', warm: 0.5, dur: 450, desc: 'Resistentes: 450 golpes.' },
  leatherboots: { name: 'Botas de couro', icon: '👢', stack: 1, type: 'clothing', slot: 'shoes', warm: 0.5, dur: 8000, desc: 'Resistentes: ≈8 km.' },
  milshirt: { name: 'Camisa militar', icon: '🪖', stack: 1, type: 'clothing', slot: 'shirt', mil: true, armor: 0.05, warm: 2, pockets: [4, 2], dur: 3000, desc: 'Camuflada e resistente: 8 bolsos.' },
  milpants: { name: 'Calça militar', icon: '👖', stack: 1, type: 'clothing', slot: 'pants', mil: true, armor: 0.05, warm: 1.5, pockets: [4, 2], dur: 3000, desc: 'Camuflada e resistente: 8 bolsos.' },
  milhelmet: { name: 'Capacete militar', icon: '⛑️', stack: 1, type: 'clothing', slot: 'hat', mil: true, armor: 0.1, head: 0.6, dur: 2000, desc: 'Protege a cabeça: tiros na cabeça causam bem menos dano.' },
  milgloves: { name: 'Luvas táticas', icon: '🧤', stack: 1, type: 'clothing', slot: 'gloves', mil: true, warm: 0.5, dur: 1200, desc: 'Muito resistentes: 1200 golpes.' },
  milboots: { name: 'Coturno militar', icon: '🥾', stack: 1, type: 'clothing', slot: 'shoes', mil: true, warm: 1, dur: 25000, desc: 'Quase não gastam: ≈25 km.' },
  pack_impro: { name: 'Mochila improvisada', icon: '🎒', img: 'pack_impro', stack: 1, type: 'backpack', slots: 20, desc: 'Saco de pano amarrado em galhos. 20 espaços (5×4).' },
  pack_small: { name: 'Mochila pequena', icon: '🎒', img: 'pack_small', stack: 1, type: 'backpack', slots: 35, desc: '35 espaços em grade (7×5). Encontrada em casas e baús.' },
  pack_medium: { name: 'Mochila média', icon: '🎒', img: 'pack_medium', stack: 1, type: 'backpack', slots: 55, desc: '55 espaços em grade (5×11).' },
  pack_large: { name: 'Mochila grande', icon: '🎒', img: 'pack_large', stack: 1, type: 'backpack', slots: 70, desc: '70 espaços em grade (10×7).' },
  pack_climb: { name: 'Mochila de escalada', icon: '🎒', img: 'pack_climb', stack: 1, type: 'backpack', slots: 110, desc: '110 espaços (10×11), com corda e saco de dormir. Só na zona tóxica e em bases militares.' },
  ratsuit: { name: 'Roupa R.A.T', icon: '☣️', img: 'ratsuit', stack: 1, type: 'suit', armor: 0.15, warm: 3, desc: 'Roupa de Área Tóxica: máscara de gás e traje selado. Protege da névoa tóxica e da radiação. Ao vestir, as outras roupas e a mochila caem no chão; tem uma mochila própria de 12 espaços (4×3). Encontrada em laboratórios.' },
  pill_green: { name: 'Comprimido verde', icon: '💊', img: 'pill_green', stack: 10, type: 'medical', pill: true, cure: ['poison', 'tox'], desc: 'Toxinas, venenos e enjoo. A cartela vem com quantidade variada.' },
  pill_orange: { name: 'Comprimido laranja', icon: '💊', img: 'pill_orange', stack: 10, type: 'medical', pill: true, cure: ['fever'], desc: 'Febre e inflamação.' },
  pill_yellow: { name: 'Comprimido amarelo', icon: '💊', img: 'pill_yellow', stack: 10, type: 'medical', pill: true, cure: ['fatigue'], energy: 25, desc: 'Fadiga, fraqueza e sistema nervoso. +25 energia.' },
  pill_blue: { name: 'Comprimido azul', icon: '💊', img: 'pill_blue', stack: 10, type: 'medical', pill: true, cure: ['hypo'], desc: 'Hipotermia, falta de ar e mente. Aquece o corpo.' },
  radpills: { name: 'Remédio antirradiação', icon: '☢️', img: 'radpills', stack: 6, type: 'medical', bottle: true, cure: ['rad'], desc: 'Frasco de iodeto. Única cura para a contaminação por radiação. Encontrado em laboratórios e bases militares.' },
  soap: { name: 'Sabonete líquido', icon: '🧴', stack: 3, type: 'misc', desc: 'Lave itens contaminados num rio ou lago (perto da água, botão E).' },
  antidote: { name: 'Antídoto', icon: '🧪', stack: 5, type: 'medical', heal: 5, cure: ['poison'], desc: 'Neutraliza veneno de escorpião.' },
};

// Fabricação (combinação de materiais). station: null | 'bench' | 'fire'
export const RECIPES = [
  { id: 'blueprint', out: 'blueprint', n: 1, cost: { leaf: 3, fiber: 2 }, station: null },
  { id: 'hammer', out: 'hammer', n: 1, cost: { stick: 2, wood: 2, fiber: 2 }, station: null },
  { id: 'axe', out: 'axe', n: 1, cost: { stick: 2, stone: 3, fiber: 2 }, station: null },
  { id: 'pickaxe', out: 'pickaxe', n: 1, cost: { stick: 2, stone: 4, fiber: 2 }, station: null },
  { id: 'spear', out: 'spear', n: 1, cost: { stick: 3, stone: 1, fiber: 2 }, station: null },
  { id: 'c4', out: 'c4', n: 1, cost: { scrap: 2, circuit: 1, cloth: 1, crystal: 1 }, station: 'bench' },
  { id: 'shirt', out: 'shirt', n: 1, cost: { cloth: 4, cord: 2 }, station: null },
  { id: 'pants', out: 'pants', n: 1, cost: { cloth: 5, cord: 2 }, station: null },
  { id: 'clothvest', out: 'clothvest', n: 1, cost: { cloth: 3, leather: 1, cord: 1 }, station: null },
  { id: 'hat', out: 'hat', n: 1, cost: { fiber: 6, cord: 1 }, station: null },
  { id: 'fibergloves', out: 'fibergloves', n: 1, cost: { fiber: 6, cord: 1 }, station: null },
  { id: 'fibershoes', out: 'fibershoes', n: 1, cost: { fiber: 8, cord: 2 }, station: null },
  { id: 'leathergloves', out: 'leathergloves', n: 1, cost: { leather: 2, cord: 1 }, station: 'bench' },
  { id: 'leatherboots', out: 'leatherboots', n: 1, cost: { leather: 3, cord: 2 }, station: 'bench' },
  { id: 'knife', out: 'knife', n: 1, cost: { stone: 2, stick: 1, fiber: 1 }, station: null },
  { id: 'scrapknife', out: 'scrapknife', n: 1, cost: { scrap: 2, wood: 1, cloth: 1 }, station: 'bench' },
  { id: 'torch', out: 'torch', n: 1, cost: { stick: 1, leaf: 2, fiber: 1 }, station: null },
  { id: 'solarlamp', out: 'solarlamp', n: 1, cost: { solarpanel: 1, circuit: 1, scrap: 2 }, station: 'bench' },
  { id: 'cord', out: 'cord', n: 1, cost: { fiber: 3 }, station: null },
  { id: 'bow', out: 'bow', n: 1, cost: { stick: 1, cord: 2 }, station: null },
  { id: 'arrow', out: 'arrow', n: 1, cost: { stick: 1, stone: 1 }, station: null },
  { id: 'bandage', out: 'bandage', n: 1, cost: { fiber: 3, leaf: 2 }, station: null },
  { id: 'cookedmeat', out: 'cookedmeat', n: 1, cost: { meat: 1 }, station: 'fire' },
  ...['cow', 'boar', 'chicken', 'deer', 'human'].map((k) => ({ id: 'cooked_' + k, out: 'cooked_' + k, n: 1, cost: { ['meat_' + k]: 1 }, station: 'fire' })),
  { id: 'cookedmush', out: 'cookedmush', n: 1, cost: { mushroom: 1 }, station: 'fire' },
  { id: 'scrapaxe', out: 'scrapaxe', n: 1, cost: { wood: 2, scrap: 3, fiber: 2 }, station: 'bench' },
  { id: 'scrapspear', out: 'scrapspear', n: 1, cost: { wood: 3, scrap: 2, fiber: 2 }, station: 'bench' },
  { id: 'shockspear', out: 'shockspear', n: 1, cost: { wood: 2, scrap: 3, circuit: 2, core: 1 }, station: 'bench' },
  { id: 'barkarmor', out: 'barkarmor', n: 1, cost: { wood: 6, fiber: 5 }, station: 'bench' },
  { id: 'scraparmor', out: 'scraparmor', n: 1, cost: { scrap: 6, cloth: 2, circuit: 1 }, station: 'bench' },
  { id: 'ammo42', out: 'ammo42', n: 10, cost: { scrap: 2, stone: 1 }, station: 'bench' },
  { id: 'shells', out: 'shells', n: 6, cost: { scrap: 2, cloth: 1 }, station: 'bench' },
  { id: 'pistol', out: 'pistol', n: 1, cost: { scrap: 8, wood: 1, circuit: 1 }, station: 'bench' },
  { id: 'antidote', out: 'antidote', n: 1, cost: { mushroom: 2, honey: 1 }, station: 'fire' },
  { id: 'parka', out: 'parka', n: 1, cost: { cloth: 5, fiber: 4, leaf: 6 }, station: 'bench' },
  { id: 'iron', out: 'iron', n: 1, cost: { scrap: 3 }, station: 'fire' },
  { id: 'copperwire', out: 'copperwire', n: 4, cost: { circuit: 1, scrap: 1 }, station: 'bench' },
  { id: 'harpoonammo', out: 'harpoonammo', n: 1, cost: { cord: 2, iron: 1, scrap: 1 }, station: 'bench' },
  { id: 'printer3d', out: 'printer3d', n: 1, cost: { scrap: 8, iron: 4, circuit: 4, wood: 2 }, station: 'bench' },
  { id: 'epanel', out: 'epanel', n: 1, cost: { scrap: 4, circuit: 3, copperwire: 2 }, station: 'bench' },
  { id: 'windkit', out: 'windkit', n: 1, cost: { scrap: 10, iron: 3, circuit: 2, wood: 4 }, station: 'bench' },
  { id: 'wheelkit', out: 'wheelkit', n: 1, cost: { wood: 12, iron: 2, scrap: 4, circuit: 1 }, station: 'bench' },
  { id: 'battery', out: 'battery', n: 1, cost: { scrap: 4, circuit: 2, crystal: 2 }, station: 'bench' },
  { id: 'pack_impro', out: 'pack_impro', n: 1, cost: { stick: 3, cord: 3, leaf: 8 }, station: null },
  { id: 'jerrycan', out: 'jerrycan', n: 1, cost: { scrap: 4, iron: 1 }, station: 'bench' },
  { id: 'soro', out: 'soro', n: 1, cost: { water: 1, honey: 1 }, station: 'fire' },
  { id: 'boilwater', out: 'water', n: 1, cost: { dirtywater: 1 }, station: 'fire' },
  { id: 'gl', out: 'gl', n: 1, cost: { scrap: 8, gunparts: 2, iron: 3, cloth: 3, wood: 2, cord: 2 }, station: 'bench' },
  { id: 'medkit', out: 'medkit', n: 1, cost: { bandage: 2, mushroom: 2, cloth: 1 }, station: 'bench' },
];

// ---------- habilidades (liberadas lendo o livro de cada uma) ----------
export const SKILLS = [
  { id: 'carpintaria', name: 'Carpintaria', icon: '🔨', desc: 'Fundação de madeira, piso, paredes, portas, baús, abrigos e bancadas.', where: 'Você já começa com este livro.' },
  { id: 'medicina', name: 'Medicina', icon: '➕', desc: 'Kits de primeiros socorros, bandagens, soro de reidratação e antídoto.', where: 'Hospitais.' },
  { id: 'engenharia', name: 'Engenharia', icon: '⚙️', desc: 'Estruturas pesadas: roda d\'água, turbina eólica e explosivo C4 (fundações reforçadas, pontes e rampas chegam na etapa de construção).', where: 'Indústrias e bases militares.' },
  { id: 'mecanica', name: 'Mecânica', icon: '🔧', desc: 'Engrenagens, eixos e polias (kit de roda e de turbina), pistola e recuperação de veículos.', where: 'Indústrias.' },
  { id: 'eletrica', name: 'Elétrica', icon: '⚡', desc: 'Fio de cobre, painel elétrico, painel solar, lanterna solar e lança de choque.', where: 'Indústrias e prateleiras das casas.' },
  { id: 'agricultura', name: 'Agricultura', icon: '🌱', desc: 'Canteiros elevados para plantar frutas e cogumelos.', where: 'Vilarejos e cozinhas.' },
  { id: 'metalurgia', name: 'Metalurgia', icon: '⛓️', desc: 'Fundir ferro, ferramentas e lâminas reforçadas de sucata, armadura de metal e munição.', where: 'Indústrias e bases militares.' },
  { id: 'costura', name: 'Costura', icon: '🧵', desc: 'Roupas com bolsos, chapéu, colete, parka, luvas e botas de couro, armadura de casca.', where: 'Guarda-roupas das casas.' },
  { id: 'eletronica', name: 'Eletrônica', icon: '💾', desc: 'Impressora 3D, painel de controle (epanel), baterias e o detonador do C4.', where: 'Laboratórios e bases militares.' },
];
// o que cada habilidade libera (receitas por id e construções por tipo); o que não está aqui é livre (sobrevivência básica)
export const SKILL_OF = {
  wall: 'carpintaria', floor: 'carpintaria', door: 'carpintaria', chest: 'carpintaria', bench: 'carpintaria', shelter: 'carpintaria',
  bandage: 'medicina', medkit: 'medicina', antidote: 'medicina', soro: 'medicina',
  windkit: 'engenharia', waterwheel: 'engenharia', wind: 'engenharia', c4: 'engenharia',
  wheelkit: 'mecanica', pistol: 'mecanica', jerrycan: 'metalurgia', gl: 'mecanica',
  copperwire: 'eletrica', solarlamp: 'eletrica', shockspear: 'eletrica', panel: 'eletrica', solar: 'eletrica',
  planter: 'agricultura', composter: 'agricultura',
  iron: 'metalurgia', scrapaxe: 'metalurgia', scrapspear: 'metalurgia', scrapknife: 'metalurgia', scraparmor: 'metalurgia', ammo42: 'metalurgia', shells: 'metalurgia', harpoonammo: 'metalurgia',
  shirt: 'costura', pants: 'costura', clothvest: 'costura', hat: 'costura', parka: 'costura', leathergloves: 'costura', leatherboots: 'costura', barkarmor: 'costura',
  printer3d: 'eletronica', epanel: 'eletronica', battery: 'eletronica',
};
for (const s of SKILLS) ITEMS['book_' + s.id] = { name: 'Livro de ' + s.name, icon: '📕', img: 'book_' + s.id, stack: 1, type: 'book', skill: s.id, kg: 0.5, desc: `Livro raro. Clique com o botão direito e escolha "Ler" para aprender ${s.name}: ${s.desc}` };
export const PIECES = {
  flag: { name: 'Bandeira de território', icon: '🚩', cost: { wood: 4, fiber: 6, leaf: 4 }, desc: 'Marca sua área (raio de 32 m): as construções do Projeto só podem ser feitas dentro dela. Não pode ficar perto da bandeira de outro jogador.', shape: { type: 'cyl', r: 0.3, h: 4.2 }, snap: false },
  campfire: { name: 'Fogueira', icon: '🔥', cost: { stone: 5, stick: 4 }, desc: 'Luz, calor e cozinhar.', shape: { type: 'cyl', r: 0.75, h: 0.4 }, snap: false },
  tent: { name: 'Barraca', icon: '⛺', cost: { stick: 6, leaf: 8, fiber: 4 }, desc: 'Dormir e definir ponto de renascimento.', shape: { type: 'box', hx: 0.95, hz: 1.3, h: 1.4 }, snap: false },
  shelter: { name: 'Abrigo', icon: '🛖', cost: { wood: 8, leaf: 10, fiber: 4 }, desc: 'Abrigo de troncos. Dormir e renascer.', shape: { type: 'box', hx: 1.55, hz: 1.55, h: 2.6 }, snap: false },
  wall: { legacy: true, name: 'Parede', icon: '🧱', cost: { wood: 4 }, desc: 'Parede de troncos (encaixa na grade).', shape: { type: 'box', hx: 1.5, hz: 0.25, h: 2.7 }, snap: 'edge' },
  floor: { legacy: true, name: 'Piso de madeira', icon: '🟫', cost: { wood: 4 }, desc: 'Plataforma nivelada (encaixa na grade).', shape: { type: 'box', hx: 1.5, hz: 1.5, h: 0.25 }, snap: 'cell' },
  door: { legacy: true, name: 'Porta', icon: '🚪', cost: { wood: 5, fiber: 2 }, desc: 'Batente com porta que abre e fecha.', shape: { type: 'box', hx: 1.5, hz: 0.22, h: 2.7 }, snap: 'edge' },
  gtrap: { name: 'Armadilha de granada', icon: '🪤', cost: { hg_frag: 1, fiber: 2, stick: 2 }, desc: 'Granada de fragmentação presa num fio esticado entre duas estacas (2,4 m). Quem tropeçar no fio detona a granada 1 s depois. Cuidado: vale para você também.', shape: { type: 'box', hx: 1.2, hz: 0.12, h: 0.3 }, snap: false },
  chest: { name: 'Baú', icon: '🧰', cost: { wood: 8, fiber: 2 }, desc: 'Armazena 16 tipos de itens.', shape: { type: 'box', hx: 0.52, hz: 0.32, h: 0.75 }, snap: false },
  bench: { name: 'Bancada de criação', icon: '🛠️', cost: { wood: 10, stone: 6 }, desc: 'Libera receitas avançadas.', shape: { type: 'box', hx: 0.95, hz: 0.48, h: 1.0 }, snap: false },
  printer: { name: 'Impressora 3D', icon: '🖨️', cost: { printer3d: 1 }, desc: 'Imprime peças com filamento + energia.', shape: { type: 'box', hx: 0.5, hz: 0.45, h: 1.0 }, snap: false, power: 'use', kit: true },
  panel: { name: 'Painel elétrico', icon: '🎛️', cost: { epanel: 1 }, desc: 'Centro da rede elétrica.', shape: { type: 'box', hx: 0.35, hz: 0.25, h: 1.7 }, snap: false, power: 'hub', kit: true },
  solar: { name: 'Placa solar', icon: '🔷', cost: { solarpanel: 1, scrap: 2 }, desc: 'Fonte: energia do sol (até 60 W).', shape: { type: 'box', hx: 0.7, hz: 0.55, h: 1.3 }, snap: false, power: 'gen', kit: true },
  wind: { name: 'Turbina eólica', icon: '🌬️', cost: { windkit: 1 }, desc: 'Fonte: energia do vento (até 120 W).', shape: { type: 'cyl', r: 0.45, h: 6.5 }, snap: false, power: 'gen', kit: true },
  waterwheel: { name: 'Roda d’água', icon: '🛞', cost: { wheelkit: 1 }, desc: 'Fonte: 90 W constantes na beira de rio/lago.', shape: { type: 'box', hx: 1.0, hz: 1.6, h: 2.8 }, snap: false, power: 'gen', kit: true },
  battery: { name: 'Bateria', icon: '🔋', cost: { battery: 1 }, desc: 'Armazena até 6 kJ de energia.', shape: { type: 'box', hx: 0.3, hz: 0.22, h: 0.6 }, snap: false, power: 'store', kit: true },
  planter: { name: 'Canteiro elevado', icon: '🌱', cost: { wood: 4, dirt: 6, berry: 2 }, desc: 'Plante frutas: depois de algumas horas do dia dá para colher (E). Com adubo cresce no dobro da velocidade e rende mais.', shape: { type: 'box', hx: 0.95, hz: 0.6, h: 0.45 }, snap: false },
  collector: { name: 'Coletor de chuva', icon: '🛢️', cost: { wood: 4, cloth: 3, scrap: 2 }, desc: 'Barril com funil de lona: junta a água da chuva, que é potável (até 10 garrafas). E para encher garrafas.', shape: { type: 'box', hx: 0.6, hz: 0.6, h: 1.4 }, snap: false },
  composter: { name: 'Composteira', icon: '♻️', cost: { wood: 6, stick: 4 }, desc: 'Coloque 10 terras e 10 comidas (E). Cheia, a barra de compostagem começa a carregar; quando aparecer o ✔ verde em cima, pegue o adubo para os canteiros.', shape: { type: 'box', hx: 0.75, hz: 0.55, h: 1.0 }, snap: false },
  // peças do Projeto (não aparecem no menu B — construídas com o projeto na mão)
  s_found: { hidden: true, name: 'Fundação', icon: '⬛', cost: { wood: 2 }, desc: '', shape: { type: 'box', hx: 1.5, hz: 1.5, h: 3 } }, s_tfound: { hidden: true, name: 'Fundação triangular', icon: '🔺', cost: { wood: 1 }, desc: '', shape: { type: 'box', hx: 1.5, hz: 1.3, h: 3 } },
  s_wall: { hidden: true, name: 'Parede', icon: '🧱', cost: { wood: 2 }, desc: '', shape: { type: 'box', hx: 1.5, hz: 0.15, h: 3 } }, s_halfwall: { hidden: true, name: 'Meia parede', icon: '▬', cost: { wood: 1 }, desc: '', shape: { type: 'box', hx: 1.5, hz: 0.15, h: 1.5 } },
  s_doorway: { hidden: true, name: 'Parede com porta', icon: '🚪', cost: { wood: 2 }, desc: '', shape: { type: 'box', hx: 1.5, hz: 0.15, h: 3 } }, s_stairs: { hidden: true, name: 'Escada', icon: '🪜', cost: { wood: 3 }, desc: '', shape: { type: 'box', hx: 0.7, hz: 1.5, h: 3 } },
  s_ladder: { hidden: true, name: 'Escada vertical', icon: '🪜', cost: { wood: 3 }, desc: '', shape: { type: 'box', hx: 0.3, hz: 0.1, h: 3 } }, s_roof: { hidden: true, name: 'Telhado', icon: '⬜', cost: { wood: 2 }, desc: '', shape: { type: 'box', hx: 1.5, hz: 1.5, h: 0.25 } },
  s_ramp: { hidden: true, name: 'Rampa', icon: '◢', cost: { wood: 2 }, desc: '', shape: { type: 'box', hx: 1.5, hz: 1.5, h: 3 } }, s_hatch: { hidden: true, name: 'Telhado com alçapão', icon: '🔳', cost: { wood: 2 }, desc: '', shape: { type: 'box', hx: 1.5, hz: 1.5, h: 0.25 } },
  s_troof: { hidden: true, name: 'Telhado triangular', icon: '🔻', cost: { wood: 1 }, desc: '', shape: { type: 'box', hx: 1.5, hz: 1.3, h: 0.25 } },
};


// ---------- tamanho dos itens na grade (largura × altura em células) ----------
const SIZE_BY_ID = {
  canned: [1, 2], water: [1, 2], dirtywater: [1, 2], medkit: [2, 1], bandage: [1, 1],
  pill_green: [2, 1], pill_orange: [2, 1], pill_yellow: [2, 1], pill_blue: [2, 1], radpills: [1, 1], soap: [1, 2],
  axe: [1, 3], scrapaxe: [1, 3], knife: [1, 2], scrapknife: [1, 2], pickaxe: [2, 3], spear: [1, 4], scrapspear: [1, 4], shockspear: [1, 4], torch: [1, 2], solarlamp: [1, 2], bow: [1, 4],
  pistol35: [2, 1], pistol: [2, 2], pistol65: [2, 2], shotgun: [4, 2], rifle540: [4, 2], rifle: [4, 2], rifle577: [4, 2], sniper745: [5, 2], sniper: [5, 2], sniper790: [5, 2],
  scope4: [2, 1], scope8: [2, 1], ratsuit: [2, 2], scraparmor: [2, 2], barkarmor: [2, 2], vest: [2, 2], parka: [2, 2],
  rags_shirt: [2, 2], rags_pants: [2, 2], rags_shoes: [2, 1], shirt: [2, 2], pants: [2, 2], clothvest: [2, 2], parka: [2, 2], milshirt: [2, 2], milpants: [2, 2], barkarmor: [2, 2], scraparmor: [2, 2], vest: [2, 2], hat: [2, 1], milhelmet: [2, 2], fibergloves: [1, 1], leathergloves: [1, 1], milgloves: [1, 1], fibershoes: [2, 1], leatherboots: [2, 1], milboots: [2, 1],
  harpoon: [3, 2], geiger: [2, 2], c4: [2, 1], nvg: [2, 1], tire: [2, 2], mototire: [2, 2], engine: [3, 2], motoengine: [2, 2], gearbox: [2, 2], jerrycan: [2, 2], gl: [4, 2], rpg: [5, 1], rocket: [3, 1], gren_he: [1, 1], gren_gas: [1, 1], gren_smoke: [1, 1], soro: [1, 2], book_carpintaria: [2, 2], book_medicina: [2, 2], book_engenharia: [2, 2], book_mecanica: [2, 2], book_eletrica: [2, 2], book_agricultura: [2, 2], book_metalurgia: [2, 2], book_costura: [2, 2], book_eletronica: [2, 2], nvcell: [1, 1], nvcell_dead: [1, 1], harpoonammo: [3, 1], printer3d: [3, 3], epanel: [2, 2], windkit: [2, 4], wheelkit: [3, 3], battery: [2, 2], copperwire: [1, 1], filament: [1, 1], iron: [1, 1], gunparts: [1, 1],
  pack_impro: [2, 2], pack_small: [2, 2], pack_medium: [2, 3], pack_large: [3, 3], pack_climb: [3, 4], solarpanel: [2, 1], core: [1, 1], cookedmeat: [1, 1], honey: [1, 1],
};
export function itemSize(id) { return SIZE_BY_ID[id] || [1, 1]; }
// mochilas: grade (colunas × linhas)
export const PACKS = { pack_impro: [5, 4], pack_small: [7, 5], pack_medium: [5, 11], pack_large: [10, 7], pack_climb: [10, 11], ratsuit: [4, 3] };
// peso (kg) por item: valor próprio (it.kg) ou pelo tipo
const KG_TYPE = { part: 8, clothing: 0.6, resource: 0.3, food: 0.35, drink: 0.6, medical: 0.12, ammo: 0.02, tool: 1.2, armor: 3, backpack: 0.9, suit: 2.5, attachment: 0.4, machine: 6, misc: 0.3 };
const KG_ID = { wood: 0.8, stone: 1.0, scrap: 0.6, iron: 1.5, log: 6, stick: 0.2, fiber: 0.05, leaf: 0.02, cloth: 0.1, cord: 0.1, water: 0.6, shells: 0.04, arrow: 0.05, harpoonammo: 0.5,
  pistol: 1.0, pistol35: 0.8, pistol65: 1.3, shotgun: 3.4, rifle: 3.5, rifle540: 3.3, rifle577: 3.8, sniper: 5.5, sniper745: 5.0, sniper790: 6.2, bow: 1.0, harpoon: 2.2, spear: 1.5, scrapspear: 1.8, shockspear: 2.0, axe: 1.6, scrapaxe: 1.8, pickaxe: 2.0, knife: 0.3, scrapknife: 0.35 };
export function itemKg(id) { const it = ITEMS[id]; if (!it) return 0; return it.kg ?? KG_ID[id] ?? KG_TYPE[it.type] ?? 0.3; }
export const CARRY_KG = 25, MAX_KG = 60;
export const CLOTH_SLOTS = ['hat', 'shirt', 'vest', 'gloves', 'pants', 'shoes'];
export const SLOT_NAMES = { hat: 'Chapéu', shirt: 'Camisa', vest: 'Colete', gloves: 'Luvas', pants: 'Calça', shoes: 'Sapatos' };
// armas grandes vão para as costas (2 espaços), não para o inventário
export const LARGE = new Set(['gl', 'rpg', 'bow', 'shotgun', 'rifle', 'rifle540', 'rifle577', 'sniper', 'sniper745', 'sniper790', 'axe', 'scrapaxe', 'pickaxe', 'spear', 'scrapspear', 'shockspear']);
export const POCKETS = [5, 3];
export const SIDEARMS = new Set(['pistol35', 'pistol', 'pistol65', 'knife', 'scrapknife']);
export function quickClass(id) { return LARGE.has(id) || id === 'harpoon' ? 'big' : SIDEARMS.has(id) ? 'side' : 'misc'; }
export function slotClass(k) { return k < 2 ? 'big' : k === 2 ? 'side' : 'misc'; }

// Inventório em grade: cada item ocupa células conforme o tamanho; pilhas de munição/recursos somam no mesmo espaço.
// Itens contaminados por radiação (rad) não empilham com os limpos.
export class GridInventory {
  constructor() { this.conts = [{ key: 'pockets', name: 'Bolsos', w: POCKETS[0], h: POCKETS[1] }]; this.items = []; this.onChange = null; this.onAdd = null; }
  get slots() { return this.items; }
  get size() { return this.conts.reduce((a, c) => a + c.w * c.h, 0); }
  used() { return this.items.reduce((a, e) => { const [w, h] = this.dims(e); return a + w * h; }, 0); }
  dims(e) { const [w, h] = itemSize(e.id); return e.rot ? [h, w] : [w, h]; }
  _occ(skip) { const g = this.conts.map((c) => new Uint8Array(c.w * c.h)); for (const e of this.items) { if (e === skip) continue; const [w, h] = this.dims(e), c = this.conts[e.c], o = g[e.c]; if (!c) continue; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) o[(e.y + y) * c.w + e.x + x] = 1; } return g; }
  fits(ci, x, y, w, h, occ) { const c = this.conts[ci]; if (!c || x < 0 || y < 0 || x + w > c.w || y + h > c.h) return false; const o = occ[ci]; for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (o[(y + j) * c.w + x + i]) return false; return true; }
  _spot(id, occ) { const [w, h] = itemSize(id); for (let ci = this.conts.length - 1; ci >= 0; ci--) for (const [ww, hh, rot] of [[w, h, 0], [h, w, 1]]) { if (rot && w === h) continue; const c = this.conts[ci]; for (let y = 0; y + hh <= c.h; y++) for (let x = 0; x + ww <= c.w; x++) if (this.fits(ci, x, y, ww, hh, occ)) return { c: ci, x, y, rot }; } return null; }
  _mark(occ, e) { const [w, h] = this.dims(e), c = this.conts[e.c], o = occ[e.c]; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) o[(e.y + y) * c.w + e.x + x] = 1; }
  count(id) { let n = 0; for (const e of this.items) if (e.id === id) n += e.qty; return n; }
  has(cost) { for (const [id, n] of Object.entries(cost)) if (this.count(id) < n) return false; return true; }
  room(id, rad = false) { const st = ITEMS[id].stack; let r = 0; for (const e of this.items) if (e.id === id && !!e.rad === !!rad) r += st - e.qty; const occ = this._occ(); let k = 0; while (k < 60) { const sp = this._spot(id, occ); if (!sp) break; this._mark(occ, { id, ...sp }); r += st; k++; } return r; }
  add(id, qty = 1, opt = {}) {
    if (!ITEMS[id] || qty <= 0) return 0; const st = ITEMS[id].stack, rad = !!opt.rad; let left = qty;
    for (const e of this.items) { if (left <= 0) break; if (e.id === id && !!e.rad === rad && e.qty < st) { const k = Math.min(st - e.qty, left); e.qty += k; left -= k; } }
    const occ = this._occ(); while (left > 0) { const sp = this._spot(id, occ); if (!sp) break; const k = Math.min(st, left); const e = { id, qty: k, ...sp }; if (rad) e.rad = true; this.items.push(e); this._mark(occ, e); left -= k; }
    if (left !== qty) { this._changed(); this.onAdd && this.onAdd(id); } return qty - left;
  }
  remove(id, qty = 1) { let left = qty; for (let i = this.items.length - 1; i >= 0 && left > 0; i--) { const e = this.items[i]; if (e.id !== id) continue; const k = Math.min(e.qty, left); e.qty -= k; left -= k; if (e.qty <= 0) this.items.splice(i, 1); } if (left !== qty) this._changed(); return qty - left; }
  pay(cost) { if (!this.has(cost)) return false; for (const [id, n] of Object.entries(cost)) this.remove(id, n); return true; }
  takeSlot(i, qty) { const e = this.items[i]; if (!e) return null; const k = Math.min(qty ?? e.qty, e.qty); e.qty -= k; if (e.qty <= 0) this.items.splice(i, 1); this._changed(); return { id: e.id, qty: k, rad: !!e.rad }; }
  // move um item para (contêiner, x, y); junta com pilha igual se soltar em cima dela
  moveTo(i, ci, x, y, rot) {
    const e = this.items[i]; if (!e) return false; const tgt = this.items.find((o) => o !== e && o.c === ci && x >= o.x && y >= o.y && x < o.x + this.dims(o)[0] && y < o.y + this.dims(o)[1]);
    if (tgt && tgt.id === e.id && !!tgt.rad === !!e.rad) { const st = ITEMS[e.id].stack, k = Math.min(st - tgt.qty, e.qty); if (k <= 0) return false; tgt.qty += k; e.qty -= k; if (e.qty <= 0) this.items.splice(i, 1); this._changed(); return true; }
    const r = rot ?? e.rot ?? 0; const [w, h] = itemSize(e.id); const [ww, hh] = r ? [h, w] : [w, h]; if (!this.fits(ci, x, y, ww, hh, this._occ(e))) return false; e.c = ci; e.x = x; e.y = y; e.rot = r ? 1 : 0; this._changed(); return true;
  }
  split(i) { const e = this.items[i]; if (!e || e.qty < 2) return false; const occ = this._occ(); const sp = this._spot(e.id, occ); if (!sp) return false; const h = Math.floor(e.qty / 2); e.qty -= h; const n = { id: e.id, qty: h, ...sp }; if (e.rad) n.rad = true; this.items.push(n); this._changed(); return true; }
  // troca os contêineres (ex.: nova mochila); devolve o que não couber
  setContainers(list) {
    const old = this.conts, keep = this.items; this.conts = list; this.items = []; const out = []; const occ = this._occ();
    const sorted = [...keep].sort((a, b) => { const [aw, ah] = itemSize(a.id), [bw, bh] = itemSize(b.id); return bw * bh - aw * ah; });
    for (const e of sorted) { const ck = old[e.c] && old[e.c].key; const ci = list.findIndex((c) => c.key === ck); const [w, h] = this.dims(e);
      if (ci >= 0 && this.fits(ci, e.x, e.y, w, h, occ)) { e.c = ci; this.items.push(e); this._mark(occ, e); continue; }
      const sp = this._spot(e.id, occ); if (sp) { Object.assign(e, sp); this.items.push(e); this._mark(occ, e); } else out.push({ id: e.id, qty: e.qty, rad: !!e.rad }); }
    this._changed(); return out;
  }
  itemsIn(key) { const ci = this.conts.findIndex((c) => c.key === key); return ci < 0 ? [] : this.items.filter((e) => e.c === ci); }
  clearContainer(key) { const ci = this.conts.findIndex((c) => c.key === key); if (ci < 0) return []; const out = this.items.filter((e) => e.c === ci).map((e) => ({ id: e.id, qty: e.qty, rad: !!e.rad })); this.items = this.items.filter((e) => e.c !== ci); this._changed(); return out; }
  kg() { let t = 0; for (const e of this.items) t += itemKg(e.id) * e.qty; return t; }
  // organiza: junta pilhas e reempacota tudo do maior para o menor
  organize() { const m = []; for (const e of this.items) { const st = ITEMS[e.id].stack; let left = e.qty; for (const o of m) { if (left <= 0) break; if (o.id === e.id && !!o.rad === !!e.rad && o.qty < st) { const k = Math.min(st - o.qty, left); o.qty += k; left -= k; } } if (left > 0) m.push({ ...e, qty: left }); }
    m.sort((a, b) => { const [aw, ah] = itemSize(a.id), [bw, bh] = itemSize(b.id); return bw * bh - aw * ah || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0); });
    this.items = []; const occ = this._occ(); const out = []; for (const e of m) { const sp = this._spot(e.id, occ); if (sp) { Object.assign(e, sp); this.items.push(e); this._mark(occ, e); } else out.push(e); } this._changed(); return out; }
  decontaminate() { let n = 0; for (const e of this.items) if (e.rad) { delete e.rad; n++; } const merged = []; for (const e of this.items) { const m = merged.find((o) => o.id === e.id && !o.rad && o.qty < ITEMS[e.id].stack && itemSize(e.id)[0] * itemSize(e.id)[1] === 1); if (m && m !== e) { const k = Math.min(ITEMS[e.id].stack - m.qty, e.qty); m.qty += k; e.qty -= k; if (e.qty > 0) merged.push(e); } else merged.push(e); } this.items = merged; if (n) this._changed(); return n; }
  contaminated() { return this.items.filter((e) => e.rad).length; }
  _changed() { this.onChange && this.onChange(); }
  serialize() { return { v: 2, items: this.items.map((e) => [e.id, e.qty, e.c, e.x, e.y, e.rot ? 1 : 0, e.rad ? 1 : 0]) }; }
  load(a) {
    const AL = { ammo9: 'ammo42', ammo556: 'ammo555', ammo762: 'ammo769', backpack: 'pack_small', milpack: 'pack_large' }; this.items = [];
    if (a && a.v === 2) { const occ = this._occ(); for (const [id0, qty, c, x, y, rot, rad] of a.items) { const id = AL[id0] || id0; if (!ITEMS[id]) continue; const e = { id, qty, c, x, y, rot }; if (rad) e.rad = true; const [w, h] = this.dims(e); if (this.fits(c, x, y, w, h, occ)) { this.items.push(e); this._mark(occ, e); } else this._pending = (this._pending || []).concat([{ id, qty, rad: !!rad }]); } }
    else for (const s of a || []) if (s) { const id = AL[s[0]] || s[0]; if (ITEMS[id]) this.add(id, s[1]); }
    for (const p of this._pending || []) this.add(p.id, p.qty, { rad: p.rad }); this._pending = null; this._changed();
  }
}

export class Inventory {
  constructor(size = 24, hotbar = 0) { this.size = size; this.hotbar = hotbar; this.slots = new Array(size).fill(null); this.onChange = null; }
  resize(n) { const out = []; if (n < this.size) for (let i = n; i < this.size; i++) if (this.slots[i]) out.push(this.slots[i]); this.slots = n > this.size ? this.slots.concat(new Array(n - this.size).fill(null)) : this.slots.slice(0, n); this.size = n; for (const s of out) { const k = this.add(s.id, s.qty); if (k < s.qty) s.qty -= k; else s.qty = 0; } this._changed && this._changed(); return out.filter((s) => s.qty > 0); }
  count(id) { let n = 0; for (const s of this.slots) if (s && s.id === id) n += s.qty; return n; }
  has(cost) { for (const [id, n] of Object.entries(cost)) if (this.count(id) < n) return false; return true; }
  // quantidade que cabe
  room(id) { const st = ITEMS[id].stack; let r = 0; for (const s of this.slots) { if (!s) r += st; else if (s.id === id) r += st - s.qty; } return r; }
  add(id, qty = 1, opt = {}) {
    if (!ITEMS[id] || qty <= 0) return 0; const st = ITEMS[id].stack; let left = qty; const rad = !!opt.rad;
    for (const s of this.slots) { if (left <= 0) break; if (s && s.id === id && !!s.rad === rad && s.qty < st) { const k = Math.min(st - s.qty, left); s.qty += k; left -= k; } }
    // novos itens vão para a mochila (espaços 7+); a barra rápida (1–6) só é usada se a mochila estiver cheia
    const hb = this.hotbar; const order = [...Array(this.size).keys()].filter((i) => i >= hb).concat([...Array(hb).keys()]);
    for (const i of order) { if (left <= 0) break; if (!this.slots[i]) { const k = Math.min(st, left); this.slots[i] = rad ? { id, qty: k, rad: true } : { id, qty: k }; left -= k; } }
    if (left !== qty) this._changed(); return qty - left; // quantidade adicionada
  }
  remove(id, qty = 1) {
    let left = qty;
    for (let i = this.size - 1; i >= 0 && left > 0; i--) { const s = this.slots[i]; if (s && s.id === id) { const k = Math.min(s.qty, left); s.qty -= k; left -= k; if (s.qty <= 0) this.slots[i] = null; } }
    if (left !== qty) this._changed(); return qty - left;
  }
  pay(cost) { if (!this.has(cost)) return false; for (const [id, n] of Object.entries(cost)) this.remove(id, n); return true; }
  takeSlot(i, qty) { const s = this.slots[i]; if (!s) return null; const k = Math.min(qty ?? s.qty, s.qty); s.qty -= k; if (s.qty <= 0) this.slots[i] = null; this._changed(); return { id: s.id, qty: k, rad: !!s.rad }; }
  move(a, b) {
    if (a === b) return; const A = this.slots[a], Bs = this.slots[b];
    if (A && Bs && A.id === Bs.id) { const st = ITEMS[A.id].stack; const k = Math.min(st - Bs.qty, A.qty); Bs.qty += k; A.qty -= k; if (A.qty <= 0) this.slots[a] = null; }
    else { this.slots[a] = Bs; this.slots[b] = A; }
    this._changed();
  }
  used() { return this.slots.filter(Boolean).length; }
  _changed() { this.onChange && this.onChange(); }
  serialize() { return this.slots.map((s) => (s ? (s.rad ? [s.id, s.qty, 1] : [s.id, s.qty]) : null)); }
  load(a) { const AL = { ammo9: 'ammo42', ammo556: 'ammo555', ammo762: 'ammo769' }; this.slots = new Array(this.size).fill(null); (a || []).forEach((s, i) => { const id = s && (AL[s[0]] || s[0]); if (s && ITEMS[id] && i < this.size) this.slots[i] = s[2] ? { id, qty: s[1], rad: true } : { id, qty: s[1] }; }); this._changed(); }
}
export const costText = (cost, inv) => Object.entries(cost).map(([id, n]) => `<span class="${inv && inv.count(id) >= n ? 'ok' : 'no'}">${ITEMS[id].icon} ${inv ? inv.count(id) + '/' : ''}${n} ${ITEMS[id].name}</span>`).join(' ');
