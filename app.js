// Global variables
let allData = [];
let filteredData = [];
let charts = {};
let currentTheme = 'light';

// Chart colors
const chartColors = ['#1FB8CD', '#FFC185', '#B4413C', '#ECEBD5', '#5D878F', '#DB4545', '#D2BA4C', '#964325', '#944454', '#13343B'];

// API configuration
const API_URL = 'https://eugvprcvaryunadretbw.supabase.co/rest/v1/pedidos_detalhamento_ab_joias';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1Z3ZwcmN2YXJ5dW5hZHJldGJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYyODk2MjcsImV4cCI6MjA2MTg2NTYyN30.AttfHF7N7j2McjNCAPxKn8oQ2SpqPdf7_IwPwwCIEHY';

// Initialize application
document.addEventListener('DOMContentLoaded', async () => {
    initializeTheme();
    initializeEventListeners();
    await loadAllData();
    initializeFilters();
    updateDashboard();
});

// Theme management
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
}

function setTheme(theme) {
    currentTheme = theme;
    document.documentElement.setAttribute('data-color-scheme', theme);
    const themeToggle = document.getElementById('theme-toggle');
    themeToggle.textContent = theme === 'light' ? '🌙' : '☀️';
    
    // Update chart colors for theme
    if (Object.keys(charts).length > 0) {
        updateChartsForTheme();
    }
}

function toggleTheme() {
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
}

// Event listeners
function initializeEventListeners() {
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
    document.getElementById('clear-filters').addEventListener('click', clearAllFilters);
    document.getElementById('cliente-search').addEventListener('input', debounce(handleClienteSearch, 300));
    document.getElementById('cliente-search').addEventListener('focus', showAutocomplete);
    document.getElementById('cliente-search').addEventListener('blur', hideAutocompleteDelayed);
    document.getElementById('top-clientes-select').addEventListener('change', updateTopClientes);
    document.getElementById('ver-aniversariantes').addEventListener('click', showAniversariantesModal);
    
    // Modal event listeners
    const clienteModal = document.getElementById('cliente-modal');
    const aniversariantesModal = document.getElementById('aniversariantes-modal');
    
    // Cliente modal
    const clienteCloseBtn = clienteModal.querySelector('.modal-close');
    clienteCloseBtn.addEventListener('click', () => clienteModal.style.display = 'none');
    
    // Aniversariantes modal
    const aniversariantesCloseBtn = aniversariantesModal.querySelector('.modal-close');
    aniversariantesCloseBtn.addEventListener('click', () => aniversariantesModal.style.display = 'none');
    
    // Window click to close modals
    window.addEventListener('click', (event) => {
        if (event.target === clienteModal) {
            clienteModal.style.display = 'none';
        }
        if (event.target === aniversariantesModal) {
            aniversariantesModal.style.display = 'none';
        }
    });

    // Event delegation for Ver Detalhes buttons
    document.addEventListener('click', (event) => {
        if (event.target.classList.contains('btn-ver-detalhes')) {
            const clienteEmail = event.target.getAttribute('data-cliente-email');
            showClienteDetails(clienteEmail);
        }
    });
}

// Data loading with pagination
async function loadAllData() {
    const loadingText = document.getElementById('loading-text');
    const progressFill = document.getElementById('progress-fill');
    
    try {
        loadingText.textContent = 'Carregando dados...';
        
        // Get total count first
        const countResponse = await fetch(`${API_URL}?select=*&limit=1`, {
            headers: {
                'apikey': API_KEY,
                'Authorization': `Bearer ${API_KEY}`,
                'Prefer': 'count=exact'
            }
        });
        
        const totalCount = parseInt(countResponse.headers.get('content-range').split('/')[1]);
        loadingText.textContent = `Carregando ${totalCount} registros...`;
        
        const batchSize = 1000;
        const totalBatches = Math.ceil(totalCount / batchSize);
        let loadedData = [];
        
        for (let i = 0; i < totalBatches; i++) {
            const start = i * batchSize;
            const end = Math.min(start + batchSize - 1, totalCount - 1);
            
            const response = await fetch(`${API_URL}?select=*`, {
                headers: {
                    'apikey': API_KEY,
                    'Authorization': `Bearer ${API_KEY}`,
                    'Range': `${start}-${end}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`Erro ao carregar dados: ${response.status}`);
            }
            
            const batch = await response.json();
            loadedData = loadedData.concat(batch);
            
            const progress = ((i + 1) / totalBatches) * 100;
            progressFill.style.width = `${progress}%`;
            loadingText.textContent = `Carregado ${loadedData.length} de ${totalCount} registros...`;
        }
        
        allData = loadedData;

        // Converter campos numéricos
        allData = allData.map(item => ({
            ...item,
            item_quantidade: parseFloat(item.item_quantidade) || 0,
            item_preco_venda: parseFloat(item.item_preco_venda) || 0,
            valor_envio: parseFloat(item.valor_envio) || 0,
            valor_desconto: parseFloat(item.valor_desconto) || 0
        }));
        filteredData = [...allData];
        
        loadingText.textContent = `Carregamento concluído! ${allData.length} registros carregados.`;
        
        setTimeout(() => {
            document.getElementById('loading-overlay').style.display = 'none';
        }, 1000);
        
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        loadingText.textContent = 'Erro ao carregar dados. Tente novamente.';
    }
}

// Initialize filters
function initializeFilters() {
    const estados = [...new Set(allData.map(item => item.endereco_estado))].filter(Boolean).sort();
    const cidades = [...new Set(allData.map(item => item.endereco_cidade))].filter(Boolean).sort();
    const status = [...new Set(allData.map(item => item.situacao))].filter(Boolean).sort();
    const pagamentos = [...new Set(allData.map(item => item.pagamento_bandeira))].filter(Boolean).sort();
    
    createCheckboxFilters('estado-filters', estados, 'estado');
    createCheckboxFilters('cidade-filters', cidades, 'cidade');
    createCheckboxFilters('status-filters', status, 'status');
    createCheckboxFilters('pagamento-filters', pagamentos, 'pagamento');
}

function createCheckboxFilters(containerId, options, filterType) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    
    options.forEach(option => {
        const checkboxItem = document.createElement('div');
        checkboxItem.className = 'checkbox-item';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `${filterType}-${option}`;
        checkbox.value = option;
        checkbox.addEventListener('change', () => {
            if (filterType === 'estado' || filterType === 'cidade') {
                updateLocationFilters();
            } else if (filterType === 'status' || filterType === 'pagamento') {
                updateStatusPaymentFilters();
            }
            filterData();
        });
        
        const label = document.createElement('label');
        label.htmlFor = checkbox.id;
        label.textContent = option;
        
        checkboxItem.appendChild(checkbox);
        checkboxItem.appendChild(label);
        container.appendChild(checkboxItem);
    });
}

// Interconnected filters logic
function updateLocationFilters() {
    const selectedEstados = getSelectedCheckboxValues('estado-filters');
    const selectedCidades = getSelectedCheckboxValues('cidade-filters');
    
    let availableCidades = [];
    let availableEstados = [];
    
    if (selectedEstados.length > 0) {
        availableCidades = [...new Set(
            allData.filter(item => selectedEstados.includes(item.endereco_estado))
                   .map(item => item.endereco_cidade)
        )].filter(Boolean).sort();
    } else if (selectedCidades.length > 0) {
        availableEstados = [...new Set(
            allData.filter(item => selectedCidades.includes(item.endereco_cidade))
                   .map(item => item.endereco_estado)
        )].filter(Boolean).sort();
        availableCidades = [...new Set(allData.map(item => item.endereco_cidade))].filter(Boolean).sort();
    } else {
        availableCidades = [...new Set(allData.map(item => item.endereco_cidade))].filter(Boolean).sort();
        availableEstados = [...new Set(allData.map(item => item.endereco_estado))].filter(Boolean).sort();
    }
    
    if (selectedEstados.length > 0) {
        updateCheckboxOptions('cidade-filters', availableCidades, 'cidade', selectedCidades);
    }
    if (selectedCidades.length > 0) {
        updateCheckboxOptions('estado-filters', availableEstados, 'estado', selectedEstados);
    }
}

function updateStatusPaymentFilters() {
    const selectedStatus = getSelectedCheckboxValues('status-filters');
    const selectedPagamentos = getSelectedCheckboxValues('pagamento-filters');
    
    let availablePagamentos = [];
    let availableStatus = [];
    
    if (selectedStatus.length > 0) {
        availablePagamentos = [...new Set(
            allData.filter(item => selectedStatus.includes(item.situacao))
                   .map(item => item.pagamento_bandeira)
        )].filter(Boolean).sort();
    } else if (selectedPagamentos.length > 0) {
        availableStatus = [...new Set(
            allData.filter(item => selectedPagamentos.includes(item.pagamento_bandeira))
                   .map(item => item.situacao)
        )].filter(Boolean).sort();
        availablePagamentos = [...new Set(allData.map(item => item.pagamento_bandeira))].filter(Boolean).sort();
    } else {
        availablePagamentos = [...new Set(allData.map(item => item.pagamento_bandeira))].filter(Boolean).sort();
        availableStatus = [...new Set(allData.map(item => item.situacao))].filter(Boolean).sort();
    }
    
    if (selectedStatus.length > 0) {
        updateCheckboxOptions('pagamento-filters', availablePagamentos, 'pagamento', selectedPagamentos);
    }
    if (selectedPagamentos.length > 0) {
        updateCheckboxOptions('status-filters', availableStatus, 'status', selectedStatus);
    }
}

function updateCheckboxOptions(containerId, options, filterType, selectedValues) {
    const container = document.getElementById(containerId);
    const currentCheckboxes = container.querySelectorAll('input[type="checkbox"]');
    
    // Disable checkboxes not in available options
    currentCheckboxes.forEach(checkbox => {
        const isAvailable = options.includes(checkbox.value);
        checkbox.disabled = !isAvailable;
        checkbox.parentElement.style.opacity = isAvailable ? '1' : '0.5';
    });
}

function getSelectedCheckboxValues(containerId) {
    const container = document.getElementById(containerId);
    const checkboxes = container.querySelectorAll('input[type="checkbox"]:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

// Filter data

// Autocomplete functionality
let autocompleteVisible = false;
let hideTimeout = null;

function getUniqueClientNames() {
    const clientNames = [...new Set(allData.map(item => item.cliente_nome))].filter(Boolean);
    return clientNames.sort();
}

function handleClienteSearch() {
    const searchTerm = document.getElementById('cliente-search').value;
    updateAutocompleteList(searchTerm);
    filterData();
}

function showAutocomplete() {
    const searchTerm = document.getElementById('cliente-search').value;
    updateAutocompleteList(searchTerm);
    autocompleteVisible = true;
    if (hideTimeout) {
        clearTimeout(hideTimeout);
        hideTimeout = null;
    }
}

function hideAutocompleteDelayed() {
    hideTimeout = setTimeout(() => {
        hideAutocomplete();
    }, 200);
}

function hideAutocomplete() {
    const autocompleteList = document.getElementById('autocomplete-list');
    autocompleteList.style.display = 'none';
    autocompleteVisible = false;
}

function updateAutocompleteList(searchTerm) {
    const autocompleteList = document.getElementById('autocomplete-list');

    if (!searchTerm || searchTerm.length < 2) {
        autocompleteList.style.display = 'none';
        return;
    }

    const clientNames = getUniqueClientNames();
    const filteredNames = clientNames.filter(name => 
        name.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 10); // Limitar a 10 resultados

    if (filteredNames.length === 0) {
        autocompleteList.style.display = 'none';
        return;
    }

    autocompleteList.innerHTML = '';
    filteredNames.forEach(name => {
        const item = document.createElement('div');
        item.className = 'autocomplete-item';
        item.textContent = name;
        item.addEventListener('mousedown', () => {
            document.getElementById('cliente-search').value = name;
            hideAutocomplete();
            filterData();
        });
        autocompleteList.appendChild(item);
    });

    autocompleteList.style.display = 'block';
}

// Add global click listener to hide autocomplete when clicking outside
document.addEventListener('click', (event) => {
    const searchField = document.getElementById('cliente-search');
    const autocompleteList = document.getElementById('autocomplete-list');

    if (!searchField.contains(event.target) && !autocompleteList.contains(event.target)) {
        hideAutocomplete();
    }
});

function filterData() {
    const selectedEstados = getSelectedCheckboxValues('estado-filters');
    const selectedCidades = getSelectedCheckboxValues('cidade-filters');
    const selectedStatus = getSelectedCheckboxValues('status-filters');
    const selectedPagamentos = getSelectedCheckboxValues('pagamento-filters');
    const clienteSearch = document.getElementById('cliente-search').value.toLowerCase();
    
    filteredData = allData.filter(item => {
        const estadoMatch = selectedEstados.length === 0 || selectedEstados.includes(item.endereco_estado);
        const cidadeMatch = selectedCidades.length === 0 || selectedCidades.includes(item.endereco_cidade);
        const statusMatch = selectedStatus.length === 0 || selectedStatus.includes(item.situacao);
        const pagamentoMatch = selectedPagamentos.length === 0 || selectedPagamentos.includes(item.pagamento_bandeira);
        const clienteMatch = clienteSearch === '' || item.cliente_nome.toLowerCase().includes(clienteSearch);
        
        return estadoMatch && cidadeMatch && statusMatch && pagamentoMatch && clienteMatch;
    });
    
    updateDashboard();
}

function clearAllFilters() {
    // Clear all checkboxes
    document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
        cb.disabled = false;
        cb.parentElement.style.opacity = '1';
    });
    
    // Clear search
    document.getElementById('cliente-search').value = '';
    
    // Reset filtered data
    filteredData = [...allData];
    
    // Reinitialize filters
    initializeFilters();
    updateDashboard();
}

// Update dashboard
function updateDashboard() {
    updateKPIs();
    updateCharts();
    updateTopClientes();
}

// Update KPIs
function updateKPIs() {
    const vendasTotais = filteredData.reduce((sum, item) => sum + (parseFloat(item.item_preco_venda) || 0), 0);
    const totalPedidos = new Set(filteredData.map(item => item.numero_pedido)).size;
    const ticketMedio = totalPedidos > 0 ? vendasTotais / totalPedidos : 0;
    const clientesUnicos = new Set(filteredData.map(item => item.cliente_email)).size;
    const valorEnvio = filteredData.reduce((sum, item) => sum + (parseFloat(item.valor_envio) || 0), 0);
    const valorDesconto = filteredData.reduce((sum, item) => sum + (parseFloat(item.valor_desconto) || 0), 0);
    
    // Calculate birthday count for current month (June 2025)
    const currentMonth = 6; // June
    const aniversariantes = getAniversariantesDoMes(currentMonth);

    // Calcular total de itens
    const totalItens = filteredData.reduce((sum, item) => sum + (parseFloat(item.item_quantidade) || 0), 0);
    
    document.getElementById('vendas-totais').textContent = formatCurrency(vendasTotais);
    document.getElementById('total-pedidos').textContent = formatNumber(totalPedidos);
    document.getElementById('ticket-medio').textContent = formatCurrency(ticketMedio);
    document.getElementById('clientes-unicos').textContent = formatNumber(clientesUnicos);
    document.getElementById('valor-envio').textContent = formatCurrency(valorEnvio);
    document.getElementById('valor-desconto').textContent = formatCurrency(valorDesconto);
    document.getElementById('aniversariantes-mes').textContent = formatNumber(aniversariantes.length);
    document.getElementById('total-itens').textContent = formatNumber(totalItens);
}

function getAniversariantesDoMes(month) {
    const clientesUnicos = new Map();
    
    // Get unique clients first
    filteredData.forEach(item => {
        if (item.cliente_email && !clientesUnicos.has(item.cliente_email)) {
            clientesUnicos.set(item.cliente_email, {
                nome: item.cliente_nome,
                email: item.cliente_email,
                data_nascimento: item.cliente_data_nascimento,
                telefone: item.cliente_telefone_celular,
                cidade: item.endereco_cidade,
                estado: item.endereco_estado
            });
        }
    });
    
    // Filter by birth month
    const aniversariantes = Array.from(clientesUnicos.values()).filter(cliente => {
        if (cliente.data_nascimento) {
            const nascimento = new Date(cliente.data_nascimento);
            return nascimento.getMonth() + 1 === month;
        }
        return false;
    });
    
    return aniversariantes;
}

// Show aniversariantes modal
function showAniversariantesModal() {
    const modal = document.getElementById('aniversariantes-modal');
    const tbody = document.getElementById('aniversariantes-tbody');
    
    const aniversariantes = getAniversariantesDoMes(6); // June
    
    tbody.innerHTML = '';
    
    aniversariantes.forEach(cliente => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${cliente.nome || 'N/A'}</td>
            <td>${formatDate(cliente.data_nascimento)}</td>
            <td>${cliente.email}</td>
            <td>${cliente.telefone || 'N/A'}</td>
            <td>${cliente.cidade || 'N/A'}</td>
            <td>${cliente.estado || 'N/A'}</td>
        `;
        tbody.appendChild(row);
    });
    
    modal.style.display = 'block';
}

// Update charts
function updateCharts() {
    createVendasEstadoChart();
    createPagamentoChart();
    createProdutosChart();
    createTendenciaChart();
    createEvolucaoMensalChart();
}

function createVendasEstadoChart() {
    const ctx = document.getElementById('vendas-estado-chart').getContext('2d');
    
    if (charts.vendasEstado) {
        charts.vendasEstado.destroy();
    }
    
    const vendasPorEstado = {};
    filteredData.forEach(item => {
        const estado = item.endereco_estado || 'Não informado';
        const valor = parseFloat(item.item_preco_venda) || 0;
        vendasPorEstado[estado] = (vendasPorEstado[estado] || 0) + valor;
    });
    
    const sortedEstados = Object.entries(vendasPorEstado)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10);
    
    const labels = sortedEstados.map(([estado]) => estado);
    const data = sortedEstados.map(([,valor]) => valor);
    
    charts.vendasEstado = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Vendas (R$)',
                data: data,
                backgroundColor: chartColors.slice(0, labels.length),
                borderColor: chartColors.slice(0, labels.length),
                borderWidth: 1
            }]
        },
        options: getChartOptions('bar')
    });
}

function createPagamentoChart() {
    const ctx = document.getElementById('pagamento-chart').getContext('2d');
    
    if (charts.pagamento) {
        charts.pagamento.destroy();
    }
    
    const pagamentos = {};
    filteredData.forEach(item => {
        const pagamento = item.pagamento_bandeira || 'Não informado';
        const valor = parseFloat(item.item_preco_venda) || 0;
        pagamentos[pagamento] = (pagamentos[pagamento] || 0) + valor;
    });
    
    const labels = Object.keys(pagamentos);
    const data = Object.values(pagamentos);
    
    charts.pagamento = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: chartColors.slice(0, labels.length),
                borderColor: currentTheme === 'dark' ? '#1f2121' : '#ffffff',
                borderWidth: 0.5
            }]
        },
        options: getChartOptions('pie')
    });
}

function createProdutosChart() {
    const ctx = document.getElementById('produtos-chart').getContext('2d');
    
    if (charts.produtos) {
        charts.produtos.destroy();
    }
    
    const produtos = {};
    filteredData.forEach(item => {
        const produto = item.item_nome || 'Não informado';
        const quantidade = parseInt(item.item_quantidade) || 0;
        produtos[produto] = (produtos[produto] || 0) + quantidade;
    });
    
    const sortedProdutos = Object.entries(produtos)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10);
    
    const labels = sortedProdutos.map(([produto]) => produto.length > 20 ? produto.substring(0, 20) + '...' : produto);
    const data = sortedProdutos.map(([,quantidade]) => quantidade);
    
    charts.produtos = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Quantidade Vendida',
                data: data,
                backgroundColor: chartColors.slice(0, labels.length),
                borderColor: chartColors.slice(0, labels.length),
                borderWidth: 1
            }]
        },
        options: getChartOptions('bar', true)
    });
}

function createTendenciaChart() {
    const ctx = document.getElementById('tendencia-chart').getContext('2d');
    
    if (charts.tendencia) {
        charts.tendencia.destroy();
    }
    
    const vendasPorMes = {};
    filteredData.forEach(item => {
        if (item.data_criacao) {
            const date = new Date(item.data_criacao);
            const mesAno = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            const valor = parseFloat(item.item_preco_venda) || 0;
            vendasPorMes[mesAno] = (vendasPorMes[mesAno] || 0) + valor;
        }
    });
    
    const sortedMeses = Object.entries(vendasPorMes).sort(([a], [b]) => a.localeCompare(b));
    const labels = sortedMeses.map(([mes]) => {
        const [ano, mesNum] = mes.split('-');
        const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        return `${monthNames[parseInt(mesNum) - 1]}/${ano}`;
    });
    const data = sortedMeses.map(([,valor]) => valor);
    
    charts.tendencia = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Vendas (R$)',
                data: data,
                borderColor: chartColors[0],
                backgroundColor: chartColors[0] + '20',
                borderWidth: 3,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            ...getChartOptions('line'),
            animation: {
                duration: 2000,
                easing: 'easeInOutQuart'
            }
        }
    });
}

function createEvolucaoMensalChart() {
    const ctx = document.getElementById('evolucao-chart').getContext('2d');
    
    if (charts.evolucaoMensal) {
        charts.evolucaoMensal.destroy();
    }
    
    const vendasPorMesAno = {};
    filteredData.forEach(item => {
        if (item.data_criacao) {
            const date = new Date(item.data_criacao);
            const ano = date.getFullYear();
            const mes = date.getMonth();
            const valor = parseFloat(item.item_preco_venda) || 0;
            
            if (!vendasPorMesAno[ano]) {
                vendasPorMesAno[ano] = new Array(12).fill(0);
            }
            vendasPorMesAno[ano][mes] += valor;
        }
    });
    
    const anos = Object.keys(vendasPorMesAno).sort();
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    
    const datasets = anos.map((ano, index) => ({
        label: ano,
        data: vendasPorMesAno[ano],
        backgroundColor: chartColors[index % chartColors.length],
        borderColor: chartColors[index % chartColors.length],
        borderWidth: 1
    }));
    
    charts.evolucaoMensal = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: monthNames,
            datasets: datasets
        },
        options: {
            ...getChartOptions('bar'),
            animation: {
                duration: 2000,
                easing: 'easeInOutQuart'
            },
            scales: {
                ...getChartOptions('bar').scales,
                x: {
                    ...getChartOptions('bar').scales.x,
                    stacked: false
                },
                y: {
                    ...getChartOptions('bar').scales.y,
                    stacked: false
                }
            }
        }
    });
}

function getChartOptions(type, rotateLabels = false) {
    const textColor = currentTheme === 'dark' ? '#ffffff' : '#134252';
    const gridColor = currentTheme === 'dark' ? '#777c7c' : '#5e524080';
    
    const baseOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                labels: {
                    color: textColor,
                    font: {
                        family: 'FKGroteskNeue, Inter, sans-serif'
                    }
                }
            },
            tooltip: {
                backgroundColor: currentTheme === 'dark' ? '#262828' : '#ffffff',
                titleColor: textColor,
                bodyColor: textColor,
                borderColor: gridColor,
                borderWidth: 1
            }
        }
    };
    
    if (type !== 'pie') {
        baseOptions.scales = {
            x: {
                ticks: {
                    color: textColor,
                    maxRotation: rotateLabels ? 45 : 0
                },
                grid: {
                    color: gridColor
                }
            },
            y: {
                ticks: {
                    color: textColor,
                    callback: function(value) {
                        return type === 'line' || (type === 'bar' && !rotateLabels) ? formatCurrency(value) : value;
                    }
                },
                grid: {
                    color: gridColor
                }
            }
        };
    }
    
    return baseOptions;
}

function updateChartsForTheme() {
    Object.values(charts).forEach(chart => {
        if (chart && chart.options) {
            const textColor = currentTheme === 'dark' ? '#ffffff' : '#134252';
            const gridColor = currentTheme === 'dark' ? '#777c7c' : '#5e524080';
            
            // Update legend
            if (chart.options.plugins && chart.options.plugins.legend) {
                chart.options.plugins.legend.labels.color = textColor;
            }
            
            // Update tooltip
            if (chart.options.plugins && chart.options.plugins.tooltip) {
                chart.options.plugins.tooltip.backgroundColor = currentTheme === 'dark' ? '#262828' : '#ffffff';
                chart.options.plugins.tooltip.titleColor = textColor;
                chart.options.plugins.tooltip.bodyColor = textColor;
                chart.options.plugins.tooltip.borderColor = gridColor;
            }
            
            // Update scales
            if (chart.options.scales) {
                if (chart.options.scales.x) {
                    chart.options.scales.x.ticks.color = textColor;
                    chart.options.scales.x.grid.color = gridColor;
                }
                if (chart.options.scales.y) {
                    chart.options.scales.y.ticks.color = textColor;
                    chart.options.scales.y.grid.color = gridColor;
                }
            }
            
            chart.update();
        }
    });
}

// Top clientes
function updateTopClientes() {
    const limit = parseInt(document.getElementById('top-clientes-select').value);
    
    // Calculate client totals
    const clienteTotals = {};
    filteredData.forEach(item => {
        const email = item.cliente_email;
        if (email && !clienteTotals[email]) {
            clienteTotals[email] = {
                nome: item.cliente_nome,
                email: email,
                cidade: item.endereco_cidade,
                estado: item.endereco_estado,
                totalGasto: 0,
                qtdPedidos: new Set()
            };
        }
        if (email) {
            clienteTotals[email].totalGasto += parseFloat(item.item_preco_venda) || 0;
            clienteTotals[email].qtdPedidos.add(item.numero_pedido);
        }
    });
    
    // Convert to array and sort
    const topClientes = Object.values(clienteTotals)
        .map(cliente => ({
            ...cliente,
            qtdPedidos: cliente.qtdPedidos.size
        }))
        .sort((a, b) => b.totalGasto - a.totalGasto)
        .slice(0, limit);
    
    // Update table
    const tbody = document.getElementById('top-clientes-tbody');
    tbody.innerHTML = '';
    
    topClientes.forEach((cliente, index) => {
        const row = document.createElement('tr');
        
        const medal = getMedal(index + 1);
        const positionCell = `<div class="position-cell">${medal}${index + 1}</div>`;
        
        row.innerHTML = `
            <td>${positionCell}</td>
            <td>${cliente.nome || 'N/A'}</td>
            <td>${cliente.email}</td>
            <td>${cliente.cidade || 'N/A'}</td>
            <td>${cliente.estado || 'N/A'}</td>
            <td>${formatCurrency(cliente.totalGasto)}</td>
            <td>${cliente.qtdPedidos}</td>
            <td><button class="btn btn--sm btn--primary btn-ver-detalhes" data-cliente-email="${cliente.email}">Ver Detalhes</button></td>
        `;
        
        tbody.appendChild(row);
    });
}

function getMedal(position) {
    if (position === 1) {
        return '<span class="medal">🥇</span>';
    } else if (position === 2) {
        return '<span class="medal">🥈</span>';
    } else if (position === 3) {
        return '<span class="medal">🥉</span>';
    }
    return '';
}

// Cliente details modal
function showClienteDetails(clienteEmail) {
    const modal = document.getElementById('cliente-modal');
    const clienteData = filteredData.filter(item => item.cliente_email === clienteEmail);
    
    if (clienteData.length === 0) return;
    
    const cliente = clienteData[0];
    
    // Update modal header
    document.getElementById('modal-cliente-nome').textContent = `Detalhes - ${cliente.cliente_nome}`;
    
    // Update client info
    const clienteInfo = document.getElementById('cliente-info');
    const totalGasto = clienteData.reduce((sum, item) => sum + (parseFloat(item.item_preco_venda) || 0), 0);
    const qtdPedidos = new Set(clienteData.map(item => item.numero_pedido)).size;
    
    clienteInfo.innerHTML = `
        <p><strong>Nome:</strong> ${cliente.cliente_nome}</p>
        <p><strong>Email:</strong> ${cliente.cliente_email}</p>
        <p><strong>Telefone:</strong> ${cliente.cliente_telefone_celular || 'N/A'}</p>
        <p><strong>Endereço:</strong> ${cliente.endereco_cidade}, ${cliente.endereco_estado}</p>
        <p><strong>Total Gasto:</strong> ${formatCurrency(totalGasto)}</p>
        <p><strong>Quantidade de Pedidos:</strong> ${qtdPedidos}</p>
    `;
    
    // Update purchases table
    const tbody = document.getElementById('modal-compras-tbody');
    tbody.innerHTML = '';
    
    clienteData.forEach(item => {
        const row = document.createElement('tr');
        const status = item.situacao || 'N/A';
        const statusClass = getStatusClass(status);
        
        row.innerHTML = `
            <td>${formatDate(item.data_criacao)}</td>
            <td>${item.numero_pedido}</td>
            <td>${item.item_nome || 'N/A'}</td>
            <td>${item.item_quantidade || 0}</td>
            <td>${formatCurrency(parseFloat(item.item_preco_venda) || 0)}</td>
            <td><span class="${statusClass}">${status}</span></td>
        `;
        
        tbody.appendChild(row);
    });
    
    modal.style.display = 'block';
}

function getStatusClass(status) {
    const lowerStatus = status.toLowerCase();
    if (lowerStatus.includes('concluí') || lowerStatus.includes('entregue')) {
        return 'status-completed';
    } else if (lowerStatus.includes('cancel') || lowerStatus.includes('devolvido')) {
        return 'status-cancelled';
    } else {
        return 'status-pending';
    }
}

// Utility functions
function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
}

function formatNumber(value) {
    return new Intl.NumberFormat('pt-BR').format(value);
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Make showClienteDetails global for onclick handlers
window.showClienteDetails = showClienteDetails;