const Razorpay = require('razorpay')
const { RAZORPAY_ID_KEY, RAZORPAY_SECRET_KEY } = process.env
const orderCollection = require("../models/OrderModel")
const cartcollection = require("../models/cartModel")
const crypto=require('crypto')

const razorpayInstance = new Razorpay({
    key_id: RAZORPAY_ID_KEY,
    key_secret: RAZORPAY_SECRET_KEY
});







const createOrder = async (req, res) => {

 
    const user = req.session.user;
    const cart = await cartcollection.findOne({ user: user._id }).populate('products.productId');
    if (!cart) {
        return res.status(400).json('Cart is empty');
    }

    const min = 100000;
    const max = 999999;

    const orderId = Math.floor(Math.random() * (max - min + 1)) + min;
    let orderTotal = 0;
    cart.products.forEach(item => {
        orderTotal += item.total_price;
    })
    const order = new orderCollection({
        user: user._id,
        orderId: orderId,
        items: cart.products.map(item => ({
            product: item.productId,
            quantity: item.quantity,
            price: item.total_price,
        })),
        orderTotal: cart.Grand_total,
        orderStatus: 'pending',

        shipping_address: user.address[0],
        payment_Method:"Online Payment"
    });
    await order.save();

    await cartcollection.findOneAndDelete({ user: user._id });
     let order_id = order._id.toString()
    const amount = cart.Grand_total * 100 + 100;
    const options = {
        amount: amount,
        currency: 'INR',
        receipt:order_id
    };


    razorpayInstance.orders.create(options, (err, order) => {
        if (!err) {
       return res.json(order)


        } else {
            return res.status(400).json({ success: false, msg: 'Something went wrong' });
        }
       
    });
}

const loadOrderSuccess = async (req, res) => {
    try {
        const user = req.session.user
        res.render("orderSuccessFull", { user })
    } catch (error) {
        return res.status(400).json({ success: false, msg: "can't load this page" });
    }
}

const paymentVerification = async (req, res) => {
    try {

        const { payment, order } = req.body;

    
       

        const razorpay_signature = payment.razorpay_signature;
       

        const key_secret = process.env.RAZORPAY_SECRET_KEY;

        const hmac = crypto.createHmac('sha256', key_secret);

        

        hmac.update(order.id + "|" + payment.razorpay_payment_id);



        const generated_signature = hmac.digest('hex');
     

        if (razorpay_signature === generated_signature) {


            order_Reciept=req.body.order.receipt

            const orderDetails=await orderCollection.findOne({_id:order_Reciept})
            if(orderDetails){
                const result = await orderCollection.updateOne(
                    { _id: order_Reciept },
                    { $set: { orderStatus: "Placed" } }
                );
            }else{
                const result = await orderCollection.updateOne(
                    { _id: order_Reciept },
                    { $set: { orderStatus: "Failed" } }
                );
            }

        

            res.json({ success: true });
        } else {
            console.log("Payment verification failed");
            res.json({ success: false, message: "Payment verification failed" });
        }
    } catch (error) {
        console.error("Error:", error);
        return res.status(400).json({ success: false, msg: "Payment verification failed" });
    }
};

module.exports = {
    loadOrderSuccess,
    createOrder,
    paymentVerification

}