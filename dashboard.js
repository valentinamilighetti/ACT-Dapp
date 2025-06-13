async function updateDashboard() {
    const dashboardStatus = document.getElementById("dashboardStatus");
    const dashboardContent = document.getElementById("dashboardContent");

    if (!accountAddr) {
        dashboardStatus.innerText = "Connect wallet to display the Dashboard.";
        return;
    }

    dashboardStatus.style.display = "none";
    dashboardContent.style.display = "block";

    document.getElementById("dashAddress").innerText = accountAddr;

    const balance = await ACTContract.methods.balanceOf(accountAddr).call();
    document.getElementById("dashBalance").innerText = balance;

    const fromBlock = 0;
    const toBlock = "latest";

    const tokensMinted = await ACTContract.getPastEvents("TokensMinted", {
        filter: { recipient: accountAddr },
        fromBlock, toBlock
    });

    let totalClaimed = tokensMinted.reduce((sum, ev) => sum + parseInt(ev.returnValues.amount), 0);
    document.getElementById("dashTotalClaimed").innerText = totalClaimed.toString();

    const courseEvents = await ACTContract.getPastEvents("courseCompleted", {
        filter: { user: accountAddr },
        fromBlock, toBlock
    });
    const uniqueCourses = new Set(courseEvents.map(ev => ev.returnValues.courseId));

    const courseNames = await Promise.all(
        Array.from(uniqueCourses).map(async id => {
            const course = await ACTContract.methods.courses(id).call();
            return course.name;
        })
    );
    document.getElementById("dashCourses").innerHTML = `
        <span class="stat-tooltip" data-tooltip="${courseNames.join('\n')}">
            ${uniqueCourses.size}
        </span>
    `;

    const badgeEvents = await ACTContract.getPastEvents("badgeRedeemed", {
        filter: { user: accountAddr },
        fromBlock, toBlock
    });
    const uniqueBadges = new Set(badgeEvents.map(ev => ev.returnValues.badgeId));

    const badgeNames = await Promise.all(
        Array.from(uniqueBadges).map(async id => {
            const badge = await ACTContract.methods.badge(id).call();
            return badge.name;
        })
    );
    document.getElementById("dashBadges").innerHTML = `
        <span class="stat-tooltip" data-tooltip="${badgeNames.join('\n')}">
            ${uniqueBadges.size}
        </span>
    `;

    // maximim level of badge => level of the account
    let maxLevel = 0;
    for (let ev of badgeEvents) {
        const badgeId = ev.returnValues.badgeId;
        const badge = await ACTContract.methods.badge(badgeId).call();
        const level = Number(badge.level);
        if (level > maxLevel) maxLevel = level;
    }
    document.getElementById("dashLevel").innerText = maxLevel > 0 ? `Level ${maxLevel}` : "Beginner";

    const projectEvents = await ACTContract.getPastEvents("ProjectCompensated", {
        filter: { user: accountAddr },
        fromBlock, toBlock
    });
    const uniqueProjects = new Set(projectEvents.map(ev => ev.returnValues.projectId));

    const projectNames = await Promise.all(
        Array.from(uniqueProjects).map(async id => {
            const project = await ACTContract.methods.projects(id).call();
            return project.name;
        })
    );
    document.getElementById("dashProjects").innerHTML = `
        <span class="stat-tooltip" data-tooltip="${projectNames.join('\n')}">
            ${uniqueProjects.size}
        </span>
    `;

    const allEvents = [
        ...tokensMinted.map(ev => ({ ...ev, type: "ACT purchase" })),
        ...courseEvents.map(ev => ({ ...ev, type: "Course purchase" })),
        ...badgeEvents.map(ev => ({ ...ev, type: "Bade purchase" })),
        ...projectEvents.map(ev => ({ ...ev, type: "Project contribution" }))
    ];
    const transactionList = document.getElementById("dashTransactions");
    transactionList.innerHTML = "";

    for (const ev of allEvents.sort((a, b) => Number(b.blockNumber) - Number(a.blockNumber))) {
        const li = document.createElement("li");
        li.className = "activity-item";

        const link = `https://sepolia.etherscan.io/tx/${ev.transactionHash}`;
        const block = await web3.eth.getBlock(ev.blockNumber);
        const timestamp = new Date(Number(block.timestamp) * 1000).toLocaleString('it-IT', {
            dateStyle: 'short',
            timeStyle: 'short'
        });

        li.innerHTML = `
            <div class="activity-content">
                <div class="activity-type">
                    <i class="fas ${getTransactionIcon(ev.type)}"></i>
                    <span class="activity-description">${formatTransactionType(ev.type)}</span>
                </div>
                <div class="activity-meta">
                    <span class="activity-date">${timestamp}</span>
                    <a href="${link}" target="_blank" class="tx-link">
                    ${ev.transactionHash.slice(0, 8)}...
                    </a>
                </div>
                </div>
            `;
        transactionList.appendChild(li);
    }

    function getTransactionIcon(type) {
      const icons = {
        'Mint': 'fa-coins',
        'Transfer': 'fa-exchange-alt',
        'Purchase': 'fa-shopping-cart',
        'Reward': 'fa-gift',
        'Contribution': 'fa-hand-holding-heart'
      };
      return icons[type] || 'fa-circle-dot';
    }

    function formatTransactionType(type) {
      return type.replace(/([A-Z])/g, ' $1').trim();
    }
}