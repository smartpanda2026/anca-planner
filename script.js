// ============================================================================
// GLOBAL STATE
// ============================================================================
let akrisData = null;
let treatmentCharts = {};

// ============================================================================
// INITIALIZATION
// ============================================================================
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('startDate').valueAsDate = new Date();
    document.getElementById('currentPatient').textContent = 'New Patient';
});

// ============================================================================
// UI TOGGLE FUNCTIONS
// ============================================================================
function toggleAdvancedOptions() {
    const inductionChoice = document.getElementById('inductionChoice').value;
    const steroidChoice = document.getElementById('steroidChoice').value;
    
    document.getElementById('advancedOptions').style.display = 'block';
    document.getElementById('cycDosesDiv').style.display = 
        inductionChoice === '3' ? 'block' : 'none';
}

// ============================================================================
// AKRiS CALCULATOR
// ============================================================================
function calculateAKRiS() {
    const creatinine = parseFloat(document.getElementById('creatinine').value);
    const normalGlom = parseFloat(document.getElementById('normalGlom').value);
    const ifta = parseInt(document.getElementById('iftaGrade').value);
    
    if (!creatinine || isNaN(normalGlom) || isNaN(ifta)) {
        showAlert('akrisResult', 'Please fill in all AKRiS parameters', 'warning');
        return;
    }
    
    let score = 0;
    
    // Creatinine scoring
    if (creatinine > 450) score += 11;
    else if (creatinine >= 250) score += 4;
    
    // Normal glomeruli scoring
    if (normalGlom < 10) score += 7;
    else if (normalGlom <= 25) score += 4;
    
    // IFTA scoring
    if (ifta >= 2) score += 3;
    
    // Risk categorization
    let category, survival, recommendation, colorClass;
    if (score <= 4) {
        category = 'LOW RISK';
        survival = 96;
        recommendation = 'Standard monitoring, consider treatment de-escalation';
        colorClass = 'success';
    } else if (score <= 11) {
        category = 'MEDIUM RISK';
        survival = 75;
        recommendation = 'Close monitoring, maintain standard therapy';
        colorClass = 'warning';
    } else if (score <= 18) {
        category = 'HIGH RISK';
        survival = 49;
        recommendation = 'Intensive monitoring, consider novel therapies';
        colorClass = 'danger';
    } else {
        category = 'VERY HIGH RISK';
        survival = 12;
        recommendation = 'Maximal therapy, prepare for RRT if decline continues';
        colorClass = 'danger';
    }
    
    akrisData = { score, category, survival, recommendation };
    
    const resultHTML = `
        <div class="alert alert-${colorClass} fade-in-up">
            <h6><strong>AKRiS Score: ${score}</strong> - ${category}</h6>
            <p class="mb-1">36-month kidney survival: <strong>${survival}%</strong></p>
            <p class="mb-0"><em>${recommendation}</em></p>
        </div>
    `;
    
    document.getElementById('akrisResult').innerHTML = resultHTML;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
function showAlert(elementId, message, type) {
    const element = document.getElementById(elementId);
    element.innerHTML = `
        <div class="alert alert-${type} fade-in-up">${message}</div>
    `;
}

function formatDate(date) {
    return date.toISOString().split('T')[0];
}

function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

function addWeeks(date, weeks) {
    return addDays(date, weeks * 7);
}

function addMonths(date, months) {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
}

// ============================================================================
// CYCLOPHOSPHAMIDE DOSING CALCULATOR
// ============================================================================
function calculateCyclophosphamide(age, weight, egfr, regimen) {
    if (regimen === 'reduced') {
        return {
            dose: 500,
            perKg: null,
            explanation: 'Fixed 500 mg (reduced regimen for rituximab combination)'
        };
    }
    
    let basePerKg, ageNote;
    
    if (age > 70) {
        basePerKg = 10.0;
        ageNote = 'Age >70 → 10 mg/kg';
    } else if (age > 60) {
        basePerKg = 12.5;
        ageNote = 'Age >60 → 12.5 mg/kg';
    } else {
        basePerKg = 15.0;
        ageNote = 'Age ≤60 → 15 mg/kg';
    }
    
    let renalNote;
    if (egfr < 30) {
        basePerKg -= 2.5;
        renalNote = 'eGFR <30 → subtract 2.5 mg/kg';
    } else {
        renalNote = 'eGFR ≥30 → no adjustment';
    }
    
    let dose = Math.round(basePerKg * weight);
    dose = Math.min(dose, 1200); // Safety cap
    
    return {
        dose: dose,
        perKg: basePerKg,
        explanation: `${ageNote}\n${renalNote}\nDose: ${basePerKg.toFixed(1)} × ${weight} kg = ${dose} mg`
    };
}

// ============================================================================
// PREDNISONE TAPER CALCULATOR
// ============================================================================
function getPrednisoneTaper(weight) {
    let taper = [];
    
    if (weight < 50) {
        taper = [
            [1,50],[2,25],[3,20],[4,20],[5,15],[6,15],
            [7,12.5],[8,12.5],[9,10],[10,10],[11,7.5],[12,7.5],
            [13,6],[14,6]
        ];
        for (let w = 15; w <= 52; w++) taper.push([w, 5]);
    } else if (weight <= 75) {
        taper = [
            [1,60],[2,30],[3,25],[4,25],[5,20],[6,20],
            [7,15],[8,15],[9,12.5],[10,12.5],[11,10],[12,10],
            [13,7.5],[14,7.5]
        ];
        for (let w = 15; w <= 52; w++) taper.push([w, 5]);
    } else {
        taper = [
            [1,75],[2,40],[3,30],[4,30],[5,25],[6,25],
            [7,20],[8,20],[9,15],[10,15],[11,12.5],[12,12.5],
            [13,10],[14,10],[15,7.5],[16,7.5],[17,7.5],[18,7.5]
        ];
        for (let w = 19; w <= 52; w++) taper.push([w, 5]);
    }
    
    return taper;
}

// ============================================================================
// RELAPSE RISK CALCULATOR
// ============================================================================
function calculateRelapseRisk(data) {
    let score = 0;
    let factors = [];
    
    if (data.ancaType === 'PR3') {
        score += 2;
        factors.push('PR3-ANCA (high relapse risk)');
    }
    
    if (data.age < 60) {
        score += 1;
        factors.push('Age <60 years');
    }
    
    if (data.egfr < 30) {
        score += 1;
        factors.push('eGFR <30 mL/min');
    }
    
    if (data.severity === 'Severe') {
        score += 1;
        factors.push('Severe presentation');
    }
    
    if (akrisData && ['HIGH RISK', 'VERY HIGH RISK'].includes(akrisData.category)) {
        score += 2;
        factors.push(`AKRiS: ${akrisData.category}`);
    }
    
    const category = score >= 4 ? 'High' : score >= 2 ? 'Moderate' : 'Low';
    const recommendations = {
        'High': 'Intensive monitoring, extended maintenance (36 months)',
        'Moderate': 'Standard monitoring, 18-month maintenance',
        'Low': 'Standard monitoring, consider shorter maintenance'
    };
    
    return {
        score,
        category,
        factors,
        recommendation: recommendations[category]
    };
}

// ============================================================================
// TREATMENT PLAN GENERATOR
// ============================================================================
function generateFullPlan() {
    // Collect patient data
    const data = {
        patientName: document.getElementById('patientName').value || 'Unknown',
        age: parseInt(document.getElementById('age').value),
        weight: parseFloat(document.getElementById('weight').value),
        creatinine: parseFloat(document.getElementById('creatinine').value),
        egfr: parseFloat(document.getElementById('egfr').value),
        proteinuria: parseFloat(document.getElementById('proteinuria').value) || 0,
        ancaType: document.getElementById('ancaType').value,
        severity: document.getElementById('severity').value,
        inductionChoice: parseInt(document.getElementById('inductionChoice').value),
        steroidChoice: document.getElementById('steroidChoice').value,
        startDate: new Date(document.getElementById('startDate').value),
        numCycDoses: parseInt(document.getElementById('numCycDoses').value) || 3,
        includeMonitoring: document.getElementById('includeMonitoring').checked,
        monitoringFreq: document.getElementById('monitoringFreq').value
    };
    
    // Generate all components
    const risk = calculateRelapseRisk(data);
    const induction = generateInductionSchedule(data);
    const steroids = generateSteroidSchedule(data);
    const maintenance = generateMaintenanceSchedule(data, risk.category);
    const monitoring = generateMonitoringPlan(data, risk);
    const supportive = generateSupportiveCare(data, risk);
    
    // Store plan
    window.currentPlan = {
        patient: data,
        risk,
        induction,
        steroids,
        maintenance,
        monitoring,
        supportive
    };
    
    // Update UI
    updatePatientHeader(data);
    displayQuickStats(data, risk);
    displayCharts(window.currentPlan);
    displayDetailedPlans(window.currentPlan);
    
    // Show results
    document.getElementById('inputSection').style.display = 'none';
    document.getElementById('resultsSection').style.display = 'block';
    document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth' });
}

function generateInductionSchedule(data) {
    const schedule = {
        type: '',
        drugs: [],
        endDate: null
    };
    
    const start = data.startDate;
    
    if (data.inductionChoice === 1) {
        // RTX + CYC
        schedule.type = 'Rituximab + Cyclophosphamide';
        
        // Rituximab
        const rtxDose = document.getElementById('rituxDose').value;
        schedule.drugs.push({
            date: new Date(start),
            drug: 'Rituximab',
            dose: `${rtxDose} mg IV`,
            category: 'rtx',
            note: 'Induction dose 1/2'
        });
        schedule.drugs.push({
            date: addWeeks(start, 2),
            drug: 'Rituximab',
            dose: `${rtxDose} mg IV`,
            category: 'rtx',
            note: 'Induction dose 2/2'
        });
        
        // Cyclophosphamide 500mg q2wk x6
        const cyc = calculateCyclophosphamide(data.age, data.weight, data.egfr, 'reduced');
        let currentDate = new Date(start);
        for (let i = 0; i < 6; i++) {
            schedule.drugs.push({
                date: new Date(currentDate),
                drug: 'Cyclophosphamide',
                dose: `${cyc.dose} mg IV`,
                category: 'cyc',
                note: `Dose ${i+1}/6 (q2wk)`
            });
            currentDate = addWeeks(currentDate, 2);
        }
        schedule.endDate = addWeeks(start, 12);
        
    } else if (data.inductionChoice === 2) {
        // RTX alone
        schedule.type = 'Rituximab alone';
        const rtxDose = document.getElementById('rituxDose').value;
        for (let i = 0; i < 4; i++) {
            schedule.drugs.push({
                date: addWeeks(start, i),
                drug: 'Rituximab',
                dose: `${rtxDose} mg IV`,
                category: 'rtx',
                note: `Dose ${i+1}/4`
            });
        }
        schedule.endDate = addWeeks(start, 3);
        
    } else {
        // CYC alone
        schedule.type = 'Cyclophosphamide alone';
        const cyc = calculateCyclophosphamide(data.age, data.weight, data.egfr, 'standard');
        let currentDate = new Date(start);
        
        // 3 doses q2wk
        for (let i = 0; i < 3; i++) {
            schedule.drugs.push({
                date: new Date(currentDate),
                drug: 'Cyclophosphamide',
                dose: `${cyc.dose} mg IV`,
                category: 'cyc',
                note: `Dose ${i+1}/3 (q2wk)<br><small>${cyc.explanation.replace(/\n/g, '<br>')}</small>`
            });
            currentDate = addWeeks(currentDate, 2);
        }
        
        // Additional doses q3wk
        for (let i = 0; i < data.numCycDoses; i++) {
            schedule.drugs.push({
                date: new Date(currentDate),
                drug: 'Cyclophosphamide',
                dose: `${cyc.dose} mg IV`,
                category: 'cyc',
                note: `Dose ${i+4}/${3+data.numCycDoses} (q3wk)`
            });
            currentDate = addWeeks(currentDate, 3);
        }
        schedule.endDate = addWeeks(start, 6 + data.numCycDoses * 3);
    }
    
    // Sort by date
    schedule.drugs.sort((a, b) => a.date - b.date);
    
    return schedule;
}

function generateSteroidSchedule(data) {
    if (data.steroidChoice === 'avacopan') {
        return {
            type: 'Avacopan (steroid-sparing)',
            schedule: [
                {
                    start: data.startDate,
                    end: addWeeks(data.startDate, 4),
                    regimen: 'Prednisone 20-30 mg/day + Avacopan 30 mg BID',
                    dose: null
                },
                {
                    start: addWeeks(data.startDate, 4),
                    end: addWeeks(data.startDate, 20),
                    regimen: 'Taper prednisone, continue Avacopan 30 mg BID',
                    dose: null
                },
                {
                    start: addWeeks(data.startDate, 20),
                    end: addWeeks(data.startDate, 52),
                    regimen: 'Avacopan 30 mg BID',
                    dose: null
                }
            ]
        };
    } else {
        const taper = getPrednisoneTaper(data.weight);
        return {
            type: `Prednisone (PEXIVAS - ${data.weight < 50 ? '<50kg' : data.weight <= 75 ? '50-75kg' : '>75kg'} protocol)`,
            schedule: taper.map(([week, dose]) => ({
                week,
                date: addWeeks(data.startDate, week - 1),
                dose,
                regimen: `Prednisone ${dose} mg/day`
            }))
        };
    }
}

function generateMaintenanceSchedule(data, riskCategory) {
    const months = riskCategory === 'High' ? [6, 12, 18, 24, 30, 36] : [6, 12, 18];
    
    return {
        drug: 'Rituximab',
        doses: months.map(m => ({
            month: m,
            date: addMonths(data.startDate, m),
            dose: '500 mg IV',
            note: m === 6 ? 'Start maintenance' : 'Continue maintenance'
        }))
    };
}

function generateMonitoringPlan(data, risk) {
    const frequency = data.monitoringFreq;
    let intervalMonths;
    
    switch(frequency) {
        case 'intensive': intervalMonths = 1.5; break;
        case 'minimal': intervalMonths = 6; break;
        default: intervalMonths = 3;
    }
    
    const visits = [];
    const totalMonths = risk.category === 'High' ? 36 : 24;
    
    for (let month = 0; month <= totalMonths; month += intervalMonths) {
        visits.push({
            month: Math.round(month * 10) / 10,
            date: addMonths(data.startDate, month),
            tests: ['CBC', 'Creatinine', 'eGFR', 'Urinalysis', 'ANCA titer'],
            predictedEgfr: predictEgfr(data.egfr, month, data.creatinine, akrisData),
            predictedProteinuria: predictProteinuria(data.proteinuria, month)
        });
    }
    
    return visits;
}

// Simple prediction models for visualization
function predictEgfr(baselineEgfr, month, creatinine, akrisData) {
    // Simple linear improvement model
    let improvement = month * 0.5; // 0.5 mL/min improvement per month
    improvement = Math.min(improvement, 30); // Cap at 30 improvement
    
    if (akrisData && akrisData.category === 'VERY HIGH RISK') {
        improvement *= 0.3;
    } else if (akrisData && akrisData.category === 'HIGH RISK') {
        improvement *= 0.6;
    }
    
    return Math.min(baselineEgfr + improvement, 90);
}

function predictProteinuria(baselineProt, month) {
    // Exponential decay model
    const reduction = baselineProt * Math.exp(-month / 6);
    return Math.max(reduction, 0.1);
}

function generateSupportiveCare(data, risk) {
    const care = [
        'PJP prophylaxis: TMP-SMX DS daily or 3×/week',
        'Calcium 1000-1200 mg + Vitamin D 800-1000 IU daily',
        'Bisphosphonate if high fracture risk (FRAX score)',
        'BP target <130/80 mmHg (ACEi/ARB preferred)',
        'Lipid management per ASCVD guidelines'
    ];
    
    if (risk.category === 'High') {
        care.push('Monthly CBC while on cyclophosphamide');
        care.push('q6 months: Immunoglobulins, CD19/20 counts');
    }
    
    if (data.egfr < 30) {
        care.push('Renal dosing adjustment for all medications');
        care.push('Nephrology co-management');
    }
    
    if (akrisData && ['HIGH RISK', 'VERY HIGH RISK'].includes(akrisData.category)) {
        care.push(`<strong>⚠️ AKRiS ${akrisData.category}:</strong> ${akrisData.recommendation}`);
    }
    
    return care;
}

// ============================================================================
// UI UPDATE FUNCTIONS
// ============================================================================
function updatePatientHeader(data) {
    document.getElementById('currentPatient').textContent = 
        `${data.patientName} | ${data.age}y | ${data.ancaType} | eGFR: ${data.egfr}`;
}

function displayQuickStats(data, risk) {
    const riskColor = { High: 'danger', Moderate: 'warning', Low: 'success' }[risk.category];
    
    document.getElementById('quickStats').innerHTML = `
        <div class="col-md-3">
            <div class="stat-card risk-${risk.category.toLowerCase()} fade-in-up">
                <div class="stat-value text-${riskColor}">${risk.category}</div>
                <div class="stat-label">Relapse Risk (Score: ${risk.score})</div>
            </div>
        </div>
        <div class="col-md-3">
            <div class="stat-card fade-in-up">
                <div class="stat-value text-primary">${data.egfr}</div>
                <div class="stat-label">Baseline eGFR (mL/min)</div>
            </div>
        </div>
        <div class="col-md-3">
            <div class="stat-card fade-in-up">
                <div class="stat-value text-info">${data.proteinuria.toFixed(1)}</div>
                <div class="stat-label">Proteinuria (g/day)</div>
            </div>
        </div>
        <div class="col-md-3">
            <div class="stat-card fade-in-up">
                <div class="stat-value text-${akrisData ? riskColor : 'secondary'}">
                    ${akrisData ? akrisData.score : 'N/A'}
                </div>
                <div class="stat-label">AKRiS Score</div>
            </div>
        </div>
    `;
}

// ============================================================================
// CHART GENERATION
// ============================================================================
function displayCharts(plan) {
    createTreatmentTimelineChart(plan);
    createPrednisoneChart(plan);
}

function createTreatmentTimelineChart(plan) {
    const ctx = document.getElementById('treatmentChart').getContext('2d');
    
    // Destroy existing chart if any
    if (treatmentCharts.timeline) {
        treatmentCharts.timeline.destroy();
    }
    
    // Prepare datasets
    const rtxInduction = [];
    const cycInduction = [];
    const rtxMaintenance = [];
    const monitoringPoints = [];
    
    // RTX Induction
    plan.induction.drugs
        .filter(d => d.drug === 'Rituximab')
        .forEach(d => {
            rtxInduction.push({
                x: d.date,
                y: 4,
                label: `${d.drug}\n${d.dose}`,
                note: d.note
            });
        });
    
    // CYC Induction
    plan.induction.drugs
        .filter(d => d.drug === 'Cyclophosphamide')
        .forEach(d => {
            cycInduction.push({
                x: d.date,
                y: 3,
                label: `${d.drug}\n${d.dose}`,
                note: d.note
            });
        });
    
    // RTX Maintenance
    plan.maintenance.doses.forEach(d => {
        rtxMaintenance.push({
            x: d.date,
            y: 2,
            label: `RTX Maint\n${d.dose}`,
            note: d.note
        });
    });
    
    // Monitoring points
    if (plan.monitoring) {
        plan.monitoring.forEach(m => {
            monitoringPoints.push({
                x: m.date,
                y: 1,
                egfr: m.predictedEgfr,
                proteinuria: m.predictedProteinuria
            });
        });
    }
    
    // Create chart
    treatmentCharts.timeline = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [
                {
                    label: 'RTX Induction',
                    data: rtxInduction,
                    backgroundColor: '#3b82f6',
                    borderColor: '#1e40af',
                    pointStyle: 'triangle',
                    pointRadius: 8,
                    borderWidth: 2
                },
                {
                    label: 'Cyclophosphamide',
                    data: cycInduction,
                    backgroundColor: '#ef4444',
                    borderColor: '#991b1b',
                    pointStyle: 'rect',
                    pointRadius: 8,
                    borderWidth: 2
                },
                {
                    label: 'RTX Maintenance',
                    data: rtxMaintenance,
                    backgroundColor: '#10b981',
                    borderColor: '#047857',
                    pointStyle: 'circle',
                    pointRadius: 8,
                    borderWidth: 2
                },
                {
                    label: 'Monitoring Visits',
                    data: monitoringPoints,
                    backgroundColor: '#8b5cf6',
                    borderColor: '#5b21b6',
                    pointStyle: 'circle',
                    pointRadius: 6,
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Treatment Administration & Monitoring Timeline',
                    font: { size: 16, weight: 'bold' }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const point = context.raw;
                            if (point.label) return point.label.replace('\n', ' - ');
                            if (point.egfr) return `eGFR: ${point.egfr.toFixed(0)}, Prot: ${point.proteinuria.toFixed(2)}`;
                            return '';
                        }
                    }
                },
                legend: {
                    position: 'bottom'
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'month',
                        displayFormats: {
                            month: 'MMM yyyy'
                        }
                    },
                    title: {
                        display: true,
                        text: 'Date'
                    }
                },
                y: {
                    min: 0,
                    max: 5,
                    ticks: {
                        stepSize: 1,
                        callback: function(value) {
                            const labels = {
                                4: 'RTX Induction',
                                3: 'Cyclophosphamide',
                                2: 'RTX Maintenance',
                                1: 'Monitoring',
                                0: ''
                            };
                            return labels[value] || '';
                        }
                    },
                    title: {
                        display: true,
                        text: 'Treatment Type'
                    }
                }
            }
        }
    });
}

function createPrednisoneChart(plan) {
    const ctx = document.getElementById('prednisoneChart').getContext('2d');
    
    if (treatmentCharts.prednisone) {
        treatmentCharts.prednisone.destroy();
    }
    
    if (plan.steroids.type.includes('Prednisone')) {
        const weeks = plan.steroids.schedule.map(s => s.week);
        const doses = plan.steroids.schedule.map(s => s.dose);
        
        treatmentCharts.prednisone = new Chart(ctx, {
            type: 'line',
            data: {
                labels: weeks,
                datasets: [{
                    label: 'Prednisone Dose',
                    data: doses,
                    borderColor: '#8b5cf6',
                    backgroundColor: 'rgba(139, 92, 246, 0.1)',
                    fill: true,
                    tension: 0.1,
                    pointRadius: 2,
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Prednisone Taper Schedule',
                        font: { size: 14, weight: 'bold' }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Week'
                        },
                        min: 0,
                        max: 52
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Dose (mg/day)'
                        },
                        min: 0,
                        max: 80
                    }
                }
            }
        });
    } else {
        // Avacopan display
        ctx.font = '14px Arial';
        ctx.fillStyle = '#666';
        ctx.textAlign = 'center';
        ctx.fillText('Avacopan 30mg BID', ctx.canvas.width/2, ctx.canvas.height/2);
        ctx.fillText('(Fixed dosing, no taper)', ctx.canvas.width/2, ctx.canvas.height/2 + 20);
    }
}

// ============================================================================
// DISPLAY DETAILED PLANS
// ============================================================================
function displayDetailedPlans(plan) {
    displayInductionSchedule(plan);
    displayMaintenanceSchedule(plan);
    displayRiskAssessment(plan);
    displaySupportiveCare(plan);
}

function displayInductionSchedule(plan) {
    let html = `<p class="text-muted">${plan.induction.type}</p>`;
    
    // Group by drug
    const rtxDoses = plan.induction.drugs.filter(d => d.drug === 'Rituximab');
    const cycDoses = plan.induction.drugs.filter(d => d.drug === 'Cyclophosphamide');
    
    if (rtxDoses.length > 0) {
        html += '<h6 class="mt-3">🔵 Rituximab</h6>';
        rtxDoses.forEach(d => {
            html += `
                <div class="treatment-timeline-item drug-rtx">
                    <div class="d-flex justify-content-between">
                        <strong>${formatDate(d.date)}</strong>
                        <span class="badge badge-rtx">${d.dose}</span>
                    </div>
                    <small class="text-muted">${d.note}</small>
                </div>
            `;
        });
    }
    
    if (cycDoses.length > 0) {
        html += '<h6 class="mt-3">🔴 Cyclophosphamide</h6>';
        cycDoses.forEach(d => {
            html += `
                <div class="treatment-timeline-item drug-cyc">
                    <div class="d-flex justify-content-between">
                        <strong>${formatDate(d.date)}</strong>
                        <span class="badge badge-cyc">${d.dose}</span>
                    </div>
                    <small class="text-muted">${d.note}</small>
                </div>
            `;
        });
    }
    
    document.getElementById('inductionSchedule').innerHTML = html;
}

function displayMaintenanceSchedule(plan) {
    let html = `<p class="text-muted">${plan.maintenance.drug} every 6 months</p>`;
    
    plan.maintenance.doses.forEach(d => {
        html += `
            <div class="treatment-timeline-item drug-rtx">
                <div class="d-flex justify-content-between">
                    <strong>Month ${d.month} (${formatDate(d.date)})</strong>
                    <span class="badge badge-rtx">${d.dose}</span>
                </div>
                <small class="text-muted">${d.note}</small>
            </div>
        `;
    });
    
    document.getElementById('maintenanceSchedule').innerHTML = html;
}

function displayRiskAssessment(plan) {
    const risk = plan.risk;
    const colors = { High: 'danger', Moderate: 'warning', Low: 'success' };
    const color = colors[risk.category];
    
    const card = document.getElementById('riskAssessmentCard');
    card.className = `card shadow-sm mb-4 risk-${risk.category.toLowerCase()}`;
    
    let html = `
        <div class="alert alert-${color}">
            <h5>Relapse Risk: <strong>${risk.category}</strong> (Score: ${risk.score}/8)</h5>
        </div>
        <h6>Risk Factors:</h6>
        <ul class="list-group mb-3">
            ${risk.factors.map(f => `<li class="list-group-item">✓ ${f}</li>`).join('')}
        </ul>
        <div class="alert alert-info">
            <strong>Recommendation:</strong> ${risk.recommendation}
        </div>
    `;
    
    if (akrisData) {
        html += `
            <div class="alert alert-${color}">
                <h6>AKRiS Score: ${akrisData.score} - ${akrisData.category}</h6>
                <p class="mb-0">36-month kidney survival: ${akrisData.survival}%</p>
            </div>
        `;
    }
    
    document.getElementById('riskAssessment').innerHTML = html;
}

function displaySupportiveCare(plan) {
    const html = `
        <h6>Supportive Care:</h6>
        <ul class="list-group">
            ${plan.supportive.map(item => `
                <li class="list-group-item">• ${item}</li>
            `).join('')}
        </ul>
        <h6 class="mt-3">Monitoring Plan:</h6>
        <div class="table-responsive">
            <table class="table table-sm table-striped">
                <thead>
                    <tr>
                        <th>Month</th>
                        <th>Date</th>
                        <th>Tests</th>
                        <th>Predicted eGFR</th>
                    </tr>
                </thead>
                <tbody>
                    ${plan.monitoring.slice(0, 10).map(m => `
                        <tr>
                            <td>${m.month}</td>
                            <td>${formatDate(m.date)}</td>
                            <td>${m.tests.join(', ')}</td>
                            <td>${m.predictedEgfr.toFixed(0)} mL/min</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        ${plan.monitoring.length > 10 ? 
            `<p class="text-muted"><em>Showing first 10 visits. Full schedule: ${plan.monitoring.length} visits.</em></p>` 
            : ''}
    `;
    
    document.getElementById('supportiveCare').innerHTML = html;
}

// ============================================================================
// EXPORT FUNCTIONS
// ============================================================================
function exportAsPDF() {
    alert('PDF export will be implemented with jsPDF library.\nFor now, use Print → Save as PDF in your browser.');
    window.print();
}

function printPlan() {
    window.print();
}

function newPlan() {
    document.getElementById('inputSection').style.display = 'block';
    document.getElementById('resultsSection').style.display = 'none';
    document.getElementById('currentPatient').textContent = 'New Patient';
    
    // Destroy charts
    Object.values(treatmentCharts).forEach(chart => chart?.destroy());
    treatmentCharts = {};
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}