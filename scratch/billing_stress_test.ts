/**
 * Concurrency Stress Test for Credit Deduction
 * 
 * This script verifies that simultaneous credit deductions are handled 
 * atomically by the deduct_organization_credits RPC.
 */

import { deductCredits, getCreditsBalance } from '../lib/credits';

async function runStressTest(organizationId: string) {
    console.log(`--- Starting Stress Test for Org: ${organizationId} ---`);
    
    const initialBalance = await getCreditsBalance(organizationId);
    console.log(`Initial Balance: $${initialBalance}`);
    
    const numRequests = 50;
    const amountPerRequest = 0.01;
    const expectedDeduction = numRequests * amountPerRequest;
    
    console.log(`Firing ${numRequests} concurrent requests of $${amountPerRequest} each...`);
    
    const startTime = Date.now();
    
    // Fire all requests in parallel
    const requests = Array.from({ length: numRequests }).map((_, i) => 
        deductCredits(
            organizationId, 
            amountPerRequest, 
            `Stress Test Request #${i + 1}`,
            `stress_test_${startTime}_${i}`
        )
    );
    
    const results = await Promise.all(requests);
    const successCount = results.filter(r => r === true).length;
    const failCount = results.filter(r => r === false).length;
    
    const endTime = Date.now();
    const finalBalance = await getCreditsBalance(organizationId);
    const actualDeduction = initialBalance - finalBalance;
    
    console.log(`\n--- Results ---`);
    console.log(`Time taken: ${endTime - startTime}ms`);
    console.log(`Successful requests: ${successCount}`);
    console.log(`Failed requests: ${failCount}`);
    console.log(`Final Balance: $${finalBalance}`);
    console.log(`Expected total deduction: $${expectedDeduction}`);
    console.log(`Actual total deduction: $${actualDeduction.toFixed(6)}`);
    
    if (Math.abs(actualDeduction - expectedDeduction) < 0.000001) {
        console.log(`\n✅ SUCCESS: All concurrent deductions were recorded correctly!`);
    } else {
        console.log(`\n❌ FAILURE: Revenue leak detected! Deduction mismatch of $${(expectedDeduction - actualDeduction).toFixed(6)}`);
    }
}

// Example usage: 
// runStressTest('your-org-id-here');
