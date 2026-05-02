import React from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';

export const SkeletonCard = () => (
    <div className="glass p-8 rounded-[2.5rem] animate-pulse">
        <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-2xl mb-6"></div>
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-md w-3/4 mb-4"></div>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-md w-1/2"></div>
    </div>
);

export const ErrorState = ({ message, onRetry }) => (
    <div className="flex flex-col items-center justify-center p-20 text-center animate-in zoom-in duration-300">
        <div className="bg-red-100 dark:bg-red-900/20 p-6 rounded-full mb-6">
            <AlertCircle size={48} className="text-red-500" />
        </div>
        <h2 className="text-2xl font-black mb-2">Something went wrong</h2>
        <p className="text-gray-500 mb-8 max-w-xs">{message || "We couldn't connect to the kitchen servers."}</p>
        <button onClick={onRetry} className="btn-primary bg-red-500 hover:bg-red-600">Try Again</button>
    </div>
);