
// FUND FLOW - FRONTEND JAVASCRIPT

const campaignList = document.getElementById("campaignList");
const campaignForm = document.getElementById("campaignForm");
const donationForm = document.getElementById("donationForm");

const campaignMessage = document.getElementById("campaignMessage");
const donationMessage = document.getElementById("message");

const donationCampaign = document.getElementById("donationCampaign");
const donorList = document.getElementById("donorList");

// Format amount in Indian Rupees
function formatMoney(amount) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0
    }).format(amount);
}


function getCampaignImage(title) {
    const name = title.toLowerCase();

    if (name.includes("education") || name.includes("child")) {
        return "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800";
    }

    if (name.includes("medical") || name.includes("health")) {
        return "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800";
    }

    if (name.includes("food") || name.includes("hunger")) {
        return "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=800";
    }

    return "https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?w=800";
}


// Display success or error messages
function showMessage(element, message, success) {
    element.textContent = message;
    element.style.color = success ? "green" : "red";
}

// LOAD CAMPAIGNS FROM API
async function loadCampaigns() {
    try {
        const response = await fetch("/api/campaigns");

        if (!response.ok) {
            throw new Error("Unable to load campaigns");
        }

        const campaigns = await response.json();

        campaignList.replaceChildren();
        donationCampaign.replaceChildren();

        const defaultOption = document.createElement("option");
        defaultOption.value = "";
        defaultOption.textContent = "Choose a campaign";
        donationCampaign.appendChild(defaultOption);

        if (campaigns.length === 0) {
            campaignList.textContent = "No campaigns available.";
        }

        campaigns.forEach(campaign => {
            const raised = Number(campaign.raised);
            const goal = Number(campaign.goal);
            const percentage = Math.min((raised / goal) * 100, 100);

            // Create campaign card
            const card = document.createElement("div");
            card.className = "campaign-card";

// Campaign image
const image = document.createElement("img");
image.src = getCampaignImage(campaign.title);
image.alt = campaign.title;
image.className = "campaign-image";
image.loading = "lazy";

image.onerror = function() {
    this.style.display = "none";
};

const title = document.createElement("h3");
            title.textContent = campaign.title;

            const description = document.createElement("p");
            description.textContent = campaign.description;

            const amount = document.createElement("p");
            amount.textContent =
                formatMoney(raised) + " raised of " + formatMoney(goal);

            const progress = document.createElement("div");
            progress.className = "progress";

            const progressBar = document.createElement("div");
            progressBar.className = "progress-bar";
            progressBar.style.width = percentage + "%";

            progress.appendChild(progressBar);

            const percentageText = document.createElement("p");
            percentageText.textContent =
                Math.round(percentage) + "% funded";

            const donateButton = document.createElement("button");
            donateButton.textContent = "Donate to this Campaign";

            donateButton.addEventListener("click", () => {
                donationCampaign.value = campaign.id;
                document.getElementById("donate").scrollIntoView({
                    behavior: "smooth"
                });
            });

            card.append(
                image,
                title,
                description,
                amount,
                progress,
                percentageText,
                donateButton
            );

            campaignList.appendChild(card);

            // Add campaign to donation dropdown
            const option = document.createElement("option");
            option.value = campaign.id;
            option.textContent = campaign.title;

            donationCampaign.appendChild(option);
        });

    } catch (error) {
        campaignList.textContent = "Error loading campaigns. Please try again.";
        console.error(error);
    }
}

// CREATE NEW CAMPAIGN
campaignForm.addEventListener("submit", async function(event) {
    event.preventDefault();

    const title = document.getElementById("campaignTitle").value.trim();
    const description =
        document.getElementById("campaignDescription").value.trim();
    const goal = Number(document.getElementById("campaignGoal").value);

    if (!title || !description || !Number.isSafeInteger(goal) || goal <= 0) {
        showMessage(
            campaignMessage,
            "Please enter valid campaign details.",
            false
        );
        return;
    }

    try {
        const response = await fetch("/api/campaigns", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                title: title,
                description: description,
                goal: goal
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "Campaign creation failed");
        }

        showMessage(
            campaignMessage,
            "Campaign created successfully!",
            true
        );

        campaignForm.reset();
        await loadCampaigns();

    } catch (error) {
        showMessage(campaignMessage, error.message, false);
    }
});

// MAKE A DONATION

// DEMO PAYMENT AND DONATION

let pendingDonation = null;

const paymentModal = document.getElementById("paymentModal");
const paymentSummary = document.getElementById("paymentSummary");
const paymentMessage = document.getElementById("paymentMessage");

const confirmPayment = document.getElementById("confirmPayment");
const cancelPayment = document.getElementById("cancelPayment");

// STEP 1: Open payment screen
donationForm.addEventListener("submit", function(event) {
    event.preventDefault();

    const donorName = document.getElementById("donorName").value.trim();
    const amount = Number(
        document.getElementById("donationAmount").value
    );
    const campaignId = Number(donationCampaign.value);

    if (
        !donorName ||
        !Number.isSafeInteger(amount) ||
        amount <= 0 ||
        !Number.isSafeInteger(campaignId) ||
        campaignId <= 0
    ) {
        showMessage(
            donationMessage,
            "Please enter valid donation details.",
            false
        );
        return;
    }

    const selectedCampaign =
        donationCampaign.options[donationCampaign.selectedIndex].text;

    pendingDonation = {
        donor_name: donorName,
        amount: amount,
        campaign_id: campaignId
    };

    paymentSummary.textContent =
        "Campaign: " + selectedCampaign +
        " | Donation: " + formatMoney(amount);

    paymentMessage.textContent = "";
    paymentModal.hidden = false;
});

// STEP 2: Confirm demo payment
confirmPayment.addEventListener("click", async function() {
    if (!pendingDonation) {
        return;
    }

    confirmPayment.disabled = true;
    confirmPayment.textContent = "Processing...";

    const paymentMethod =
        document.getElementById("demoPaymentMethod").value;

    try {
        const response = await fetch("/api/donations", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(pendingDonation)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "Donation failed");
        }

        paymentMessage.style.color = "green";
        paymentMessage.textContent =
            "Demo payment successful using " +
            paymentMethod + "! Donation recorded.";

        donationForm.reset();
        pendingDonation = null;

        await loadCampaigns();
        await loadDonors();

        // Close popup after successful recording
        paymentModal.hidden = true;

        showMessage(
            donationMessage,
            "Thank you! Your demo donation was recorded.",
            true
        );

    } catch (error) {
        paymentMessage.style.color = "red";
        paymentMessage.textContent = error.message;

    } finally {
        confirmPayment.disabled = false;
        confirmPayment.textContent = "Confirm Demo Payment";
    }
});

// STEP 3: Cancel payment
cancelPayment.addEventListener("click", function() {
    paymentModal.hidden = true;
    pendingDonation = null;
    paymentMessage.textContent = "";
});


// LOAD DONOR LIST
async function loadDonors() {
    try {
        const response = await fetch("/api/donations");

        if (!response.ok) {
            throw new Error("Unable to load donors");
        }

        const donations = await response.json();

        donorList.replaceChildren();

        if (donations.length === 0) {
            donorList.textContent = "No donations yet. Be the first supporter!";
            return;
        }

        donations.forEach(donation => {
            const card = document.createElement("div");
            card.className = "donor-card";

            const name = document.createElement("p");
            name.textContent = "Donor: " + donation.donor_name;

            const amount = document.createElement("p");
            amount.textContent = "Amount: " + formatMoney(donation.amount);

            const campaign = document.createElement("p");
            campaign.textContent = "Campaign: " + donation.campaign;

            card.append(name, amount, campaign);
            donorList.appendChild(card);
        });

    } catch (error) {
        donorList.textContent = "Error loading donor list.";
        console.error(error);
    }
}

// INITIAL PAGE LOAD
async function initializeApp() {
    await loadCampaigns();
    await loadDonors();
}

initializeApp();
