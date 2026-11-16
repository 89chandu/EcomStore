const addressForm = document.getElementById("addressForm")
const couponForm = document.getElementById("couponForm")
const couponInput = document.getElementById("couponInput")
const couponMessage = document.getElementById("couponMessage")
const removeCoupon = document.getElementById("removeCoupon")
const paymentDialog = document.getElementById("paymentDialog")
const addressNames = ["fullName", "email", "phone", "pincode", "street", "city", "state"]
let checkoutCart = []
let appliedCoupon = ""

function money(amount) {
    return `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
}

function getSubtotal() {
    return Math.round(checkoutCart.reduce((total, item) => total + item.price * item.quantity, 0) * 100) / 100
}

function couponOffer(code, subtotal) {
    if (code === "WELCOME10") {
        return { discount: Math.min(Math.round(subtotal * 10) / 100, 500) }
    }
    if (code === "SAVE200") {
        return subtotal >= 1999
            ? { discount: 200 }
            : { discount: 0, error: "SAVE200 requires a subtotal of ₹1,999 or more." }
    }
    return { discount: 0, error: "This coupon is not valid. Try WELCOME10 or SAVE200." }
}

function getDiscount() {
    return appliedCoupon ? couponOffer(appliedCoupon, getSubtotal()).discount : 0
}

function saveCheckout() {
    const address = {}
    addressNames.forEach(name => {
        address[name] = addressForm.elements.namedItem(name).value
    })
    writeStorage(storageKeys.checkout, { address, coupon: appliedCoupon })
}

function showCouponMessage(message, isError = false) {
    couponMessage.textContent = message
    couponMessage.classList.toggle("is-error", isError)
}

function renderTotals() {
    const subtotal = getSubtotal()
    const discount = getDiscount()
    document.getElementById("orderSubtotal").textContent = money(subtotal)
    document.getElementById("orderDiscount").textContent = `−${money(discount)}`
    document.getElementById("discountRow").hidden = !appliedCoupon
    document.getElementById("orderTotal").textContent = money(subtotal - discount)
    removeCoupon.hidden = !appliedCoupon
}

function refreshOrder() {
    const products = readStorage(storageKeys.products, [], value =>
        Array.isArray(value) && value.every(isValidProduct) &&
        new Set(value.map(product => product.id)).size === value.length
    )
    checkoutCart = readCart(products)
    const empty = checkoutCart.length === 0
    document.getElementById("emptyCheckout").hidden = !empty
    document.getElementById("checkoutContent").hidden = empty
    document.getElementById("addressFields").disabled = empty
    document.getElementById("proceedPayment").disabled = empty
    couponInput.disabled = empty
    couponForm.querySelector("button[type=submit]").disabled = empty
    const count = checkoutCart.reduce((total, item) => total + item.quantity, 0)
    document.getElementById("checkoutItemCount").textContent = `${count} ${count === 1 ? "item" : "items"}`

    const orderItems = document.getElementById("orderItems")
    orderItems.replaceChildren()
    checkoutCart.forEach(item => {
        const row = document.createElement("article")
        row.className = "order-item"
        const image = document.createElement("img")
        image.src = item.image
        image.alt = item.name
        const details = document.createElement("div")
        details.className = "order-item-details"
        const name = document.createElement("h3")
        name.textContent = item.name
        const quantity = document.createElement("p")
        quantity.textContent = `${money(item.price)} × ${item.quantity}`
        const price = document.createElement("span")
        price.className = "order-item-price"
        price.textContent = money(Math.round(item.price * item.quantity * 100) / 100)
        details.append(name, quantity)
        row.append(image, details, price)
        orderItems.append(row)
    })

    if (appliedCoupon) {
        const offer = couponOffer(appliedCoupon, getSubtotal())
        if (empty || offer.error) {
            appliedCoupon = ""
            showCouponMessage(empty ? "" : `${offer.error} Coupon removed.`, !empty)
            saveCheckout()
        } else {
            showCouponMessage(`${appliedCoupon} applied! You save ${money(offer.discount)}.`)
        }
    }
    renderTotals()
}

const savedCheckout = readStorage(storageKeys.checkout, {}, value =>
    value !== null && typeof value === "object" && !Array.isArray(value)
)
addressNames.forEach(name => {
    const field = addressForm.elements.namedItem(name)
    const savedValue = savedCheckout.address?.[name]
    if (typeof savedValue === "string") field.value = savedValue.slice(0, field.maxLength)
})
appliedCoupon = typeof savedCheckout.coupon === "string" ? savedCheckout.coupon : ""
couponInput.value = appliedCoupon
refreshOrder()

addressForm.addEventListener("input", event => {
    event.target.setCustomValidity("")
    saveCheckout()
})

couponForm.addEventListener("submit", event => {
    event.preventDefault()
    refreshOrder()
    if (!checkoutCart.length) return
    const code = couponInput.value.trim().toUpperCase()
    couponInput.value = code
    const offer = couponOffer(code, getSubtotal())
    if (offer.error) {
        showCouponMessage(`${offer.error}${appliedCoupon ? ` ${appliedCoupon} is still applied.` : ""}`, true)
        return
    }
    appliedCoupon = code
    showCouponMessage(`${code} applied! You save ${money(offer.discount)}.`)
    renderTotals()
    saveCheckout()
})

removeCoupon.addEventListener("click", () => {
    appliedCoupon = ""
    couponInput.value = ""
    showCouponMessage("Coupon removed.")
    renderTotals()
    saveCheckout()
})

addressForm.addEventListener("submit", event => {
    event.preventDefault()
    refreshOrder()
    if (!checkoutCart.length) return

    addressNames.forEach(name => {
        const field = addressForm.elements.namedItem(name)
        field.value = field.value.trim()
        field.setCustomValidity(field.value ? "" : "Please fill out this field.")
    })
    if (!addressForm.reportValidity()) return
    saveCheckout()

    document.getElementById("paymentAmount").textContent = money(getSubtotal() - getDiscount())
    document.getElementById("deliveryPreview").textContent =
        `Deliver to ${addressForm.elements.namedItem("fullName").value}, ${addressForm.elements.namedItem("city").value} — ${addressForm.elements.namedItem("pincode").value}`
    paymentDialog.showModal()
})

document.getElementById("closePayment").addEventListener("click", () => paymentDialog.close())
document.getElementById("backToCheckout").addEventListener("click", () => paymentDialog.close())

window.addEventListener("pageshow", refreshOrder)
window.addEventListener("storage", event => {
    if (event.key === null || event.key === storageKeys.cart || event.key === storageKeys.products) {
        if (paymentDialog.open) paymentDialog.close()
        refreshOrder()
    }
})
