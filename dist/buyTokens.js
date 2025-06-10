const registerBtn = document.getElementById("registerPractice");
const closeBtn = document.getElementsByClassName("close")[0];
const practiceForm = document.getElementById("practiceForm");
const quantityInput = document.getElementById("quantity");
const activitySelect = document.getElementById("activityType");
const estimatedTokens = document.getElementById("estimatedTokens");

// Update token estimate when activity or quantity changes
activitySelect.onchange = updateTokenEstimate;
quantityInput.onchange = updateTokenEstimate;

function updateTokenEstimate() {
    const activity = activitySelect.value;
    const quantity = parseInt(quantityInput.value);
    
    if (activity) {
        const tokens = calculateTokenReward(activity, quantity);
        estimatedTokens.textContent = tokens;
    } else {
        estimatedTokens.textContent = "0";
    }

    changeMeasureUnit(activity)
}

// Form submission
practiceForm.onsubmit = async function(e) {
    e.preventDefault();
    
    const activity = activitySelect.value;
    const quantity = parseInt(quantityInput.value);
    const tokensToReward = calculateTokenReward(activity, quantity);

    if(!accountAddr){
        alert("Devi prima collegare il wallet");
    }else{
        try {       
            const tokenPrice = "0.000125";
            totalPriceEther = (parseFloat(tokenPrice) * tokensToReward).toFixed(18);
            totalPriceWei = web3.utils.toWei(totalPriceEther, "ether");

            registerBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Invio in corso...';
            registerBtn.disabled = true;

            await ACTContract.methods.buyTokens(tokensToReward, activity, quantity)
                .send({ 
                    from: accountAddr,
                    value: totalPriceWei
                })

            alert(`Attività registrata! Riceverai ${tokensToReward} ACT token.`);

            practiceForm.reset();
            registerBtn.innerHTML = '<i class="fas fa-save"></i> Registra attività';
            registerBtn.disabled = false;
            estimatedTokens.textContent = "0";
            quantityInput.value = 1
            updateDashboard()
        } catch (error) {
            console.error("Error:", error);
            alert("Errore nella registrazione: " + error.message);
            registerBtn.innerHTML = '<i class="fas fa-save"></i> Registra attività';
            registerBtn.disabled = false;
        }
    }
}

function calculateTokenReward(activity, quantity) {
    const RATES = {
        composting: 2,       // 2 tokens per kg
        recycling: 1.5,      // 1.5 tokens per kg
        renewableEnergy: 10,  // 10 tokens per kWh
        waterSaving: 5       // 5 tokens per m³
    };
    
    return Math.floor(quantity * (RATES[activity] || 1));
}

function changeMeasureUnit(activity){
    const UNITS = {
        composting: "(kg)",       // 2 tokens per kg
        recycling: "(kg)",      // 1.5 tokens per kg
        renewableEnergy: "(kW)",  // 10 tokens per kWh
        waterSaving: "(L)"   
    }

    let unit = UNITS[activity] || ""
    document.getElementById("activity-quantity").innerText = "Quantità" + unit + ":"
}