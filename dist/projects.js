async function displayProjects() {
  const projectCounter = await ACTContract.methods.projectCounter().call();
  const projectList = document.getElementById("projectList");
  projectList.innerHTML = "";

    if (!accountAddr) {
        projectList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-wallet"></i>
                <p>${accountAddr ? 'Nessun progetto disponibile' : 'Connetti il wallet per visualizzare i progetti'}</p>
            </div>
            `;
    }else document.getElementById("createProjectButton").style.display = "block";

  if (projectCounter > 0 && accountAddr) {
    const fromBlock = 0;
    const toBlock = "latest";

    const events = await ACTContract.getPastEvents("ProjectCreated", { fromBlock, toBlock });

    const activeProjects = [];

    for (const ev of events) {
        const projectId = ev.returnValues.projectId;
        const project = await ACTContract.methods.projects(projectId).call();

        if (project.active) {
            activeProjects.push({ projectId: projectId, ...project });
        }
    }

    if (activeProjects.length === 0) {
      projectList.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-hand-holding-heart"></i>
          <p>Non ci sono progetti attivi</p>
        </div>
      `;
      return;
    }

    activeProjects.forEach((project, index) => {
      const projectId = project.projectId;
      const card = document.createElement("div");
      card.className = "card";
      
      card.innerHTML = `
        <div class="card-header">
          <i class="fas fa-hand-holding-heart"></i>
          <h3 class="card-title">${project.name}</h3>
          <span class="card-description"> ${project.description}</span><br>
          <span class="card-description">Luogo: ${project.location}</span><br>
          <span class="card-description">token mancanti: ${project.requiredTokens - project.totalContributed}</span>
        </div>
        <div class="card-body">
          <div class="card-detail">
            <i class="fas fa-coins"></i>
            <span>${project.requiredTokens} ACT richiesti</span>
          </div>
          <button class="card-button" onclick="openContributeModal(${projectId})">
            <i class="fas fa-shopping-cart"></i> Contribuisci
          </button>
        </div>
      `;

      projectList.appendChild(card);
    });
  } else {
    projectList.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-wallet"></i>
        <p>${accountAddr ? 'Nessun progetto disponibile' : 'Connetti il wallet per visualizzare i progetti'}</p>
      </div>
    `;
  }
}

async function openContributeModal(projectId) {
    
    const project = await ACTContract.methods.projects(projectId).call();
    const balance = await ACTContract.methods.balanceOf(accountAddr).call();
    const remaining = Number(project.requiredTokens) - Number(project.totalContributed);
    const max = Math.min(Number(balance), remaining);

    if(balance == 0){
        showToast("Non hai abbastanza ACT");
        return
    }

    // Create modal elements
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'contributeModal';
    modal.innerHTML = `
        <div class="modal-content contribute-modal">
            <div class="modal-header">
                <h3><i class="fas fa-hand-holding-heart"></i> Contribuisci al Progetto</h3>
                <button class="close-modal">&times;</button>
            </div>
            <div class="modal-body">
                <div class="project-info">
                    <h4>${project.name}</h4>
                    <p class="project-description">${project.description}</p>
                </div>
                
                <div class="contribute-stats">
                    <div class="stat-item">
                        <i class="fas fa-wallet"></i>
                        <span>Il tuo saldo: <strong>${Number(balance)} ACT</strong></span>
                    </div>
                    <div class="stat-item">
                        <i class="fas fa-bullseye"></i>
                        <span>Mancanti: <strong>${remaining} ACT</strong></span>
                    </div>
                    <div class="stat-item">
                        <i class="fas fa-trophy"></i>
                        <span>Puoi contribuire fino a: <strong>${max} ACT</strong></span>
                    </div>
                </div>
                
                <form id="contributeForm" class="modal-form">
                    <div class="form-group">
                        <label for="tokenAmount"><i class="fas fa-coins"></i> Token da contribuire</label>
                        <div class="quantity-control">
                            <button type="button" class="qty-btn" id="decreaseContribution">
                                <i class="fas fa-minus"></i>
                            </button>
                            <input type="number" id="tokenAmount" value="1" min="1" max="${max}">
                            <button type="button" class="qty-btn" id="increaseContribution">
                                <i class="fas fa-plus"></i>
                            </button>
                        </div>
                    </div>
                    <input type="hidden" id="contributeProjectId" value="${projectId}">
                    
                    <div class="form-actions">
                        <button type="button" class="cancel-button">Annulla</button>
                        <button type="submit" class="submit-button">
                            <i class="fas fa-paper-plane"></i> Invia Contributo
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;

    // Add to DOM
    document.body.appendChild(modal);

    // Setup event listeners
    modal.querySelector('.close-modal').addEventListener('click', () => {
        document.body.removeChild(modal);
    });

    modal.querySelector('.cancel-button').addEventListener('click', () => {
        document.body.removeChild(modal);
    });

    // Quantity controls
    const amountInput = modal.querySelector('#tokenAmount');
    modal.querySelector('#decreaseContribution').addEventListener('click', () => {
        const current = parseInt(amountInput.value) || 1;
        amountInput.value = Math.max(1, current - 1);
    });

    modal.querySelector('#increaseContribution').addEventListener('click', () => {
        const current = parseInt(amountInput.value) || 1;
        const max = parseInt(amountInput.max);
        amountInput.value = Math.min(max, current + 1);
    });

    // Form submission
    modal.querySelector('#contributeForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const amount = parseInt(amountInput.value);
        const projectId = modal.querySelector('#contributeProjectId').value;
        const submitBtn = modal.querySelector('.submit-button');
        const balance = await ACTContract.methods.balanceOf(accountAddr).call();
        const project = await ACTContract.methods.projects(projectId).call();

        try {
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Invio in corso...';
            submitBtn.disabled = true;

            if(balance >= amount && amount <= (project.requiredTokens - project.totalContributed && project.active)){
                await ACTContract.methods.compensateProject(projectId, amount).send({
                    from: accountAddr
                });
            }

            showToast('Contributo inviato con successo!', 'success');
            document.body.removeChild(modal);
            displayProjects();
            updateDashboard()
        } catch (error) {
            console.error("Contribution error:", error);
            showToast(`Errore: ${error.message}`, 'error');
            submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Invia Contributo';
            submitBtn.disabled = false;
        }
    });
}

async function createProject(){
    // Create modal container
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
        <div class="modal-header">
            <h3><i class="fas fa-hand-holding-heart"></i> Nuovo Progetto</h3>
            <button class="close-modal">&times;</button>
        </div>
        <div class="modal-body">
            <form id="projectForm" class="modal-form">
            <div class="form-group">
                <label for="projectName"><i class="fas fa-tag"></i> Nome Progetto</label>
                <input type="text" id="projectName" required>
            </div>
            
            <div class="form-group">
                <label for="projectDescription"><i class="fas fa-align-left"></i> Descrizione (Opzionale)</label>
                <textarea id="projectDescription" rows="3" placeholder="Descrizione del progetto..."></textarea>
            </div>
            
            <div class="form-group">
                <label for="projectLocation"><i class="fa-solid fa-earth-americas"></i> Luogo</label>
                <input type="text" id="projectLocation" required>
            </div>
            
            <div class="form-group">
                <label for="projectTokens"><i class="fas fa-coins"></i> Token Richiesti</label>
                <input type="number" id="projectTokens" min="1" required>
            </div>
            
            <div class="form-actions">
                <button type="button" class="cancel-button">Annulla</button>
                <button type="submit" class="submit-button">
                <i class="fas fa-plus-circle"></i> Crea Progetto
                </button>
            </div>
            </form>
        </div>
        </div>
    `;

    // Add to DOM
    document.body.appendChild(modal);
    
    // Close modal handlers
    modal.querySelector('.close-modal').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    modal.querySelector('.cancel-button').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    // Form submission
    modal.querySelector('#projectForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('projectName').value;
        const description = document.getElementById('projectDescription').value;
        const location = document.getElementById('projectLocation').value;
        const requiredTokens = parseInt(document.getElementById('projectTokens').value);
        
        try {
        // Show loading state
        const submitBtn = modal.querySelector('.submit-button');
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creazione...';
        submitBtn.disabled = true;
        
        // Call contract method
        await ACTContract.methods.createProject(
            name,
            description || '', 
            location,
            requiredTokens
        ).send({ from: accountAddr });
        
        // Close modal and refresh project list
        document.body.removeChild(modal);
        displayProjects();
        
        // Show success message
        showToast('Progetto creato con successo!', 'success');
        } catch (error) {
        console.error('Error creating project:', error);
        showToast(`Errore: ${error.message}`, 'error');
        submitBtn.innerHTML = '<i class="fas fa-plus-circle"></i> Crea Progetto';
        submitBtn.disabled = false;
        }
    });
    }

    // Helper function to show toast messages
    function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
        document.body.removeChild(toast);
        }, 300);
    }, 5000);
}