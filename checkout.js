const addressForm = document.getElementById("addressForm")
const couponForm = document.getElementById("couponForm")
const couponInput = document.getElementById("couponInput")
const couponMessage = document.getElementById("couponMessage")
const removeCoupon = document.getElementById("removeCoupon")
const paymentDialog = document.getElementById("paymentDialog")
const paymentForm = document.getElementById("paymentForm")
const paymentStatus = document.getElementById("paymentStatus")
const successDialog = document.getElementById("successDialog")
const placeOrderButton = document.getElementById("placeOrder")
const addressNames = ["fullName", "email", "phone", "pincode", "street", "city", "state"]
let checkoutCart = []
let appliedCoupon = ""
let paymentTimer = null
let paymentQuote = ""

function orderSignature() {
    return JSON.stringify({ items: checkoutCart, coupon: appliedCoupon, total: getSubtotal() - getDiscount() })
}

function setPaymentBusy(busy) {
    paymentForm.setAttribute("aria-busy", String(busy))
    document.getElementById("paymentFields").disabled = busy
    placeOrderButton.disabled = busy
    placeOrderButton.textContent = busy ? "Placing demo order…" : `Place demo order · ${money(getSubtotal() - getDiscount())}`
}

function showPaymentError(message) {
    paymentStatus.textContent = message
    paymentStatus.classList.add("is-error")
    setPaymentBusy(false)
}

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
    paymentQuote = orderSignature()
    paymentStatus.textContent = ""
    paymentStatus.classList.remove("is-error")
    setPaymentBusy(false)
    document.querySelector(".checkout-steps [aria-current]")?.removeAttribute("aria-current")
    document.getElementById("paymentStep").setAttribute("aria-current", "step")
    paymentDialog.showModal()
})

document.getElementById("closePayment").addEventListener("click", () => paymentDialog.close())
document.getElementById("backToCheckout").addEventListener("click", () => paymentDialog.close())
paymentDialog.addEventListener("close", () => {
    clearTimeout(paymentTimer)
    paymentTimer = null
    setPaymentBusy(false)
    document.getElementById("paymentStep").removeAttribute("aria-current")
    document.querySelector(".checkout-steps li:nth-child(2)").setAttribute("aria-current", "step")
})

paymentForm.addEventListener("submit", event => {
    event.preventDefault()
    if (paymentTimer !== null) return
    refreshOrder()
    if (!checkoutCart.length) {
        paymentDialog.close()
        return
    }
    if (paymentQuote !== orderSignature()) {
        paymentQuote = orderSignature()
        document.getElementById("paymentAmount").textContent = money(getSubtotal() - getDiscount())
        showPaymentError("Your order changed. Review the updated total, then place your demo order again.")
        return
    }

    setPaymentBusy(true)
    paymentStatus.classList.remove("is-error")
    paymentStatus.textContent = "Simulating payment. No money is being charged…"

    // Simulate an asynchronous payment response without calling a payment gateway.
    paymentTimer = setTimeout(() => {
        paymentTimer = null
        refreshOrder()
        if (!checkoutCart.length) {
            paymentDialog.close()
            return
        }
        if (paymentQuote !== orderSignature()) {
            paymentQuote = orderSignature()
            document.getElementById("paymentAmount").textContent = money(getSubtotal() - getDiscount())
            showPaymentError("Your order changed. Review the updated total, then place your demo order again.")
            return
        }

        const address = {}
        addressNames.forEach(name => { address[name] = addressForm.elements.namedItem(name).value.trim() })
        const order = {
            id: `ECOM-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`,
            createdAt: new Date().toISOString(),
            status: "demo-confirmed",
            items: checkoutCart.map(({ id, name, price, quantity }) => ({ id, name, price, quantity })),
            address,
            subtotal: getSubtotal(),
            coupon: appliedCoupon,
            discount: getDiscount(),
            total: Math.round((getSubtotal() - getDiscount()) * 100) / 100,
            payment: { method: "demo-card", last4: "4242", status: "simulated" }
        }
        const previousOrder = readStorage(storageKeys.lastOrder, null, value => value === null || typeof value === "object")
        if (!writeStorage(storageKeys.lastOrder, order)) {
            showPaymentError("Your order could not be saved. Allow browser storage and try again. Your cart is still here.")
            return
        }
        if (!writeStorage(storageKeys.cart, [])) {
            writeStorage(storageKeys.lastOrder, previousOrder)
            showPaymentError("Your cart could not be updated. Allow browser storage and try again.")
            return
        }

        appliedCoupon = ""
        couponInput.value = ""
        showCouponMessage("")
        saveCheckout()
        refreshOrder()
        document.getElementById("successOrderNumber").textContent = order.id
        document.getElementById("successItemCount").textContent = order.items.reduce((total, item) => total + item.quantity, 0)
        document.getElementById("successTotal").textContent = money(order.total)
        document.getElementById("successDelivery").textContent =
            `Delivery details: ${address.fullName}, ${address.street}, ${address.city}, ${address.state} — ${address.pincode}.`
        paymentDialog.close()
        successDialog.showModal()
    }, 800)
})

document.getElementById("closeSuccess").addEventListener("click", () => successDialog.close())
successDialog.addEventListener("close", () => {
    document.querySelector("#emptyCheckout .primary-button").focus()
})

window.addEventListener("pageshow", refreshOrder)
window.addEventListener("storage", event => {
    if (event.key === null || event.key === storageKeys.cart || event.key === storageKeys.products) {
        if (paymentDialog.open) paymentDialog.close()
        refreshOrder()
    }
})
