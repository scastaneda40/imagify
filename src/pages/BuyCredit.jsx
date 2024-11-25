import React, { useState } from 'react';
import { useContext } from 'react';
import { assets, plans } from '../assets/assets';
import { AppContext } from '../context/AppContext';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import axios from 'axios';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useNavigate } from 'react-router-dom';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_KEY_ID);

const CheckoutForm = ({ clientSecret, backendUrl, token }) => {

    const stripe = useStripe();
    const elements = useElements();
    const { loadCreditsData } = useContext(AppContext);
    const [loading, setLoading] = useState(false); // Add loading state
    const navigate = useNavigate()

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!stripe || !elements) {
            toast.error('Stripe is not ready.');
            return;
        }

        setLoading(true); // Disable the button while processing
        const cardElement = elements.getElement(CardElement);

        const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
            payment_method: {
                card: cardElement,
            },
        });

        if (error) {
            console.error(error.message);
            toast.error(error.message);
            setLoading(false); // Re-enable the button if there's an error
        } else if (paymentIntent.status === 'succeeded') {
            console.log('Payment succeeded:', paymentIntent);
            toast.success('Payment succeeded!');

            try {
                // Send payment confirmation to your server
                const { data } = await axios.post(
                    backendUrl + '/api/user/verify-stripe',
                    { id: paymentIntent.id },
                    { headers: { token } } // Ensure token is passed correctly
                );

                if (data.success) {
                    loadCreditsData(); // Refresh user's credits data
                    toast.success('Credits Added Successfully');
                    navigate('/')
                } else {
                    toast.error(data.message || 'Failed to update credits');
                }
            } catch (serverError) {
                console.error(serverError.message);
                toast.error('An error occurred while updating credits.');
            } finally {
                setLoading(false); // Re-enable the button after processing
            }
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <CardElement
                options={{
                    style: {
                        base: {
                            fontSize: '16px',
                            color: '#424770',
                            '::placeholder': {
                                color: '#aab7c4',
                            },
                        },
                        invalid: {
                            color: '#9e2146',
                        },
                    },
                }}
            />
            <button
                type="submit"
                className="w-full bg-gray-800 text-white mt-8 text-sm rounded-md py-2.5"
                disabled={!stripe || loading} // Disable while loading
            >
                {loading ? 'Processing...' : 'Pay Now'}
            </button>
        </form>
    );
};



const BuyCredit = () => {
    const { user, backendUrl, token, setShowLogin } = useContext(AppContext);
    const [clientSecret, setClientSecret] = useState(null);
    const [selectedPlan, setSelectedPlan] = useState(null);

    const stripePay = async (planId) => {
        try {
            if (!user) {
                setShowLogin(true);
                return;
            }

            const { data } = await axios.post(
                backendUrl + '/api/user/pay-stripe',
                { planId },
                { headers: { token } }
            );

            if (data.success) {
                setClientSecret(data.clientSecret);
                setSelectedPlan(planId);
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            console.error(error);
            toast.error(error.message);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0.2, y: 100 }}
            transition={{ duration: 1 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="min-h-[80vh] text-center pt-14 mb-10"
        >
            <button className="border border-gray-400 px-10 py-2 rounded-full mb-6">Our Plans</button>
            <h1 className="text-center text-3xl font-medium mb-6 sm:mb-10">Choose the plan</h1>

            <div className="flex flex-wrap justify-center gap-6 text-left">
                {plans.map((item, index) => (
                    <div
                        key={index}
                        className="bg-white drop-shadow-sm border rounded-lg py-12 px-8 text-gray-600 hover:scale-105 transition-all duration-500"
                    >
                        <img wdith={40} src={assets.logo_icon} alt="" />
                        <p className="mt-3 mb-1 font-semibold">{item.id}</p>
                        <p className="text-sm">{item.desc}</p>
                        <p className="mt-6">
                            <span className="text-3xl font-medium">${item.price}</span> / {item.credits} credits
                        </p>
                        <button
                            onClick={() => stripePay(item.id)}
                            className="w-full bg-gray-800 text-white mt-8 text-sm rounded-md py-2.5 min-w-52"
                        >
                            {user ? 'Purchase' : 'Get Started'}
                        </button>
                    </div>
                ))}
            </div>

            {clientSecret && (
                <div className="mt-10">
                    <h2 className="text-xl font-semibold mb-4">Complete Your Payment</h2>
                    <Elements stripe={stripePromise}>
                        <CheckoutForm clientSecret={clientSecret} backendUrl={backendUrl} token={token} />
                    </Elements>
                </div>
            )}
        </motion.div>
    );
};

export default BuyCredit;
