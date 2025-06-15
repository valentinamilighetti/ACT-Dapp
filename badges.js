async function displayBadges() {

    const badgeCounter = await ACTContract.methods.badgeCounter().call();
    const badgeList = document.getElementById("badgeList");
    badgeList.innerHTML = "";
    ownerAddress = await ACTContract.methods.owner().call();

    if(accountAddr)
        if(ownerAddress.toLowerCase() === accountAddr.toLowerCase())
            document.getElementById("createBadgeButton").style.display = "block";

    if (badgeCounter > 0 && accountAddr) {
    
        const fromBlock = 0;
        const toBlock = "latest";

        const badges = await ACTContract.getPastEvents("BadgeCreated", { fromBlock, toBlock });
        const accountBadges = await ACTContract.getPastEvents("badgeRedeemed", {
        filter: { user: accountAddr },
        fromBlock, toBlock
        });

        const redeemedIds = new Set(accountBadges.map(ev => ev.returnValues.badgeId));
        const availableBadges = badges.filter(ev => !redeemedIds.has(ev.returnValues.badgeId));

        const badgeDetails = await Promise.all(
        availableBadges.map(ev =>
            ACTContract.methods.badge(ev.returnValues.badgeId).call()
        )
        );

        if (availableBadges.length === 0) {
        badgeList.innerHTML = `
            <div class="empty-state">
            <i class="fas fa-trophy"></i>
            <p>You have already obtained all available badges!</p>
            </div>
        `;
        return;
        }

        badgeDetails.forEach((badge, index) => {
            const badgeId = availableBadges[index].returnValues.badgeId;
            const card = document.createElement("div");
            card.className = "card";
            
            card.innerHTML = `
                <div class="card-header" style="background-color: ${getBadgeColor(badge.level)};">
                <i class="fas fa-award card-icon"></i>
                <h3 class="card-title">${badge.name}</h3>
                <span class="card-level">Level ${badge.level}</span>
                </div>
                <div class="card-body">
                <div class="card-detail">
                    <i class="fas fa-coins"></i>
                    <span>${badge.requiredTokens} ACT required</span>
                </div>
                <button class="card-button" onclick="buyBadge(${badgeId})">
                    <i class="fas fa-shopping-cart"></i> Get Badge
                </button>
                </div>
            `;

            badgeList.appendChild(card);
        });
    } else {
        badgeList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-wallet"></i>
                <p>${accountAddr ? 'No badges available' : 'Connect wallet to view badges'}</p>
            </div>
            `;
    }
}

async function buyBadge(badgeId) {
    try {
        const fromBlock = 0;
        const toBlock = "latest";
        const badge = await ACTContract.methods.badge(badgeId).call();
        let balance = await ACTContract.methods.balanceOf(accountAddr).call();
        const badgeEvents = await ACTContract.getPastEvents("badgeRedeemed", {
            filter: { user: accountAddr },
            fromBlock, toBlock
        });
        let maxLevel = 0;
        for (let ev of badgeEvents) {
            const badgeId = ev.returnValues.badgeId;
            const badge = await ACTContract.methods.badge(badgeId).call();
            const level = Number(badge.level);
            if (level > maxLevel) maxLevel = level;
        }

        badgeLevel =  parseInt(badge.level)

        if(balance >= badge.requiredTokens){
            if(maxLevel>badgeLevel || maxLevel == badgeLevel-1){
                await ACTContract.methods.buyBadge(badgeId).send({
                    from: accountAddr
                }); 
                showToast(`Badge ${badge.name} redeemed!`, 'success');
                displayBadges(); 
                updateDashboard()  
            }else showToast("Your level is too low", "warning");
        }else showToast("You don't have enough ACT", "warning");
        
    } catch (err) {
        showToast("Error during purchase: " + err.message, "error");
    }
}

async function createBadge(){
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
        <div class="modal-header">
            <h3><i class="fas fa-award"></i> New Badge</h3>
            <button class="close-modal">&times;</button>
        </div>
        <div class="modal-body">
            <form id="badgeForm" class="modal-form">
            <div class="form-group">
                <label for="badgeName"><i class="fas fa-tag"></i> Badge name</label>
                <input type="text" id="badgeName" required>
            </div>
            
            <div class="form-group">
                <label for="badgeDescription"><i class="fas fa-align-left"></i> Description </label>
                <textarea id="badgeDescription" rows="3"></textarea>
            </div>
            
            <div class="form-group">
                <label for="badgeLevel"><i class="fas fa-layer-group"></i> Level</label>
                <select id="badgeLevel" required>
                ${Array.from({length: 5}, (_, i) => `<option value="${i+1}">Level ${i+1}</option>`).join('')}
                </select>
            </div>
            
            <div class="form-group">
                <label for="badgeTokens"><i class="fas fa-coins"></i> Required token</label>
                <input type="number" id="badgeTokens" min="1" required>
            </div>
            
            <div class="form-actions">
                <button type="button" class="cancel-button">Cancel</button>
                <button type="submit" class="submit-button">
                <i class="fas fa-plus-circle"></i> Create Badge
                </button>
            </div>
            </form>
        </div>
        </div>
    `;

    document.body.appendChild(modal);
    
    modal.querySelector('.close-modal').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    modal.querySelector('.cancel-button').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    modal.querySelector('#badgeForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('badgeName').value;
        const description = document.getElementById('badgeDescription').value;
        const level = parseInt(document.getElementById('badgeLevel').value);
        const requiredTokens = parseInt(document.getElementById('badgeTokens').value);
        
        try {
            const submitBtn = modal.querySelector('.submit-button');
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
            submitBtn.disabled = true;
            
            await ACTContract.methods.createBadge(
                name,
                description || '', 
                level,
                requiredTokens
            ).send({ from: accountAddr });
            
            document.body.removeChild(modal);
            displayBadges();
            updateDashboard()
            
            showToast('Badge created!', 'success');
        } catch (error) {
            console.error('Error creating badge:', error);
            showToast(`Errore: ${error.message}`, 'error');
            submitBtn.innerHTML = '<i class="fas fa-plus-circle"></i> Create Badge';
            submitBtn.disabled = false;
        }
    });
}

function getBadgeColor(level) {
  const colors = {
    1: '#E3F2FD',  // Light blue
    2: '#BBDEFB',  // Medium blue
    3: '#90CAF9',  // Stronger blue
    4: '#64B5F6',  // Blue
    5: '#42A5F5'   // Darker blue
  };
  return colors[level] || '#E3F2FD'; // Default light blue
}