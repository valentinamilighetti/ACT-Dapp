async function displayProjects() {
    const projectCounter = await ACTContract.methods.projectCounter().call();
    const projectList = document.getElementById("projectList");
    projectList.innerHTML = "";

    if (!accountAddr) {
        projectList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-wallet"></i>
                <p>${accountAddr ? 'No projects available' : 'Connect wallet to view projects'}</p>
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
                <p>There are no active projects</p>
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
                <span class="card-description">Location: ${project.location}</span><br>
                <span class="card-description">missing tokens: ${project.requiredTokens - project.totalContributed}</span>
            </div>
            <div class="card-body">
                <div class="card-detail">
                <i class="fas fa-coins"></i>
                <span>${project.requiredTokens} Required ACT</span>
                </div>
                <button class="card-button" onclick="openContributeModal(${projectId})">
                <i class="fas fa-shopping-cart"></i> Contribute
                </button>
            </div>
            `;

            projectList.appendChild(card);
        });
    } else {
        projectList.innerHTML = `
            <div class="empty-state">
            <i class="fas fa-wallet"></i>
            <p>${accountAddr ? 'No projects available' : 'Connect wallet to view projects'}</p>
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
        showToast("You don't have enough ACT");
        return
    }

    // Create modal elements
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'contributeModal';
    modal.innerHTML = `
        <div class="modal-content contribute-modal">
            <div class="modal-header">
                <h3><i class="fas fa-hand-holding-heart"></i> Contribute project</h3>
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
                        <span>Your balance: <strong>${Number(balance)} ACT</strong></span>
                    </div>
                    <div class="stat-item">
                        <i class="fas fa-bullseye"></i>
                        <span>Missing: <strong>${remaining} ACT</strong></span>
                    </div>
                    <div class="stat-item">
                        <i class="fas fa-trophy"></i>
                        <span>You can contribute up to: <strong>${max} ACT</strong></span>
                    </div>
                </div>
                
                <form id="contributeForm" class="modal-form">
                    <div class="form-group">
                        <label for="tokenAmount"><i class="fas fa-coins"></i> Token to be contributed</label>
                        <div class="quantity-control">
                            <input type="number" id="tokenAmount" value="1" min="1" max="${max}">
                        </div>
                    </div>
                    <input type="hidden" id="contributeProjectId" value="${projectId}">
                    
                    <div class="form-actions">
                        <button type="button" class="cancel-button">Cancel</button>
                        <button type="submit" class="submit-button">
                            <i class="fas fa-paper-plane"></i> Contribute
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

    const amountInput = modal.querySelector('#tokenAmount');

    modal.querySelector('#contributeForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const amount = parseInt(amountInput.value);
        const projectId = modal.querySelector('#contributeProjectId').value;
        const submitBtn = modal.querySelector('.submit-button');
        const balance = await ACTContract.methods.balanceOf(accountAddr).call();
        const project = await ACTContract.methods.projects(projectId).call();
        const remaining = project.requiredTokens - project.totalContributed

        if(balance >= amount && amount <= remaining && project.active)
            try {
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
                submitBtn.disabled = true;

                await ACTContract.methods.compensateProject(projectId, amount).send({
                    from: accountAddr
                });

                showToast('Contribution sent successfully!', 'success');
                document.body.removeChild(modal);
                displayProjects();
                updateDashboard()
            } catch (error) {
                console.error("Contribution error:", error);
                showToast(`Errore: ${error.message}`, 'error');
                submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Contribute';
                submitBtn.disabled = false;
            }
        else showToast("You don't have enough ACT")
    });
}

async function createProject(){
    // Create modal container
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
        <div class="modal-header">
            <h3><i class="fas fa-hand-holding-heart"></i> New Project</h3>
            <button class="close-modal">&times;</button>
        </div>
        <div class="modal-body">
            <form id="projectForm" class="modal-form">
            <div class="form-group">
                <label for="projectName"><i class="fas fa-tag"></i> Project name</label>
                <input type="text" id="projectName" required>
            </div>
            
            <div class="form-group">
                <label for="projectDescription"><i class="fas fa-align-left"></i> Description</label>
                <textarea id="projectDescription" rows="3"></textarea>
            </div>
            
            <div class="form-group">
                <label for="projectLocation"><i class="fa-solid fa-earth-americas"></i> Location</label>
                <input type="text" id="projectLocation" required>
            </div>
            
            <div class="form-group">
                <label for="projectTokens"><i class="fas fa-coins"></i> Required token</label>
                <input type="number" id="projectTokens" min="1" required>
            </div>
            
            <div class="form-actions">
                <button type="button" class="cancel-button">Cancel</button>
                <button type="submit" class="submit-button">
                <i class="fas fa-plus-circle"></i> Create Project
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
    
    modal.querySelector('#projectForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('projectName').value;
        const description = document.getElementById('projectDescription').value;
        const location = document.getElementById('projectLocation').value;
        const requiredTokens = parseInt(document.getElementById('projectTokens').value);
        
        try {
            const submitBtn = modal.querySelector('.submit-button');
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
            submitBtn.disabled = true;
            
            await ACTContract.methods.createProject(
                name,
                description || '', 
                location,
                requiredTokens
            ).send({ from: accountAddr });
            
            document.body.removeChild(modal);
            displayProjects();
            
            showToast('Project successfully created!', 'success');
        } catch (error) {
            console.error('Error creating project:', error);
            showToast(`Errore: ${error.message}`, 'error');
            submitBtn.innerHTML = '<i class="fas fa-plus-circle"></i> Create Project';
            submitBtn.disabled = false;
        }
    });
    }

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