import { describe, expect, it } from "vitest";
import { employeePrompt } from "@/lib/copilot/employee";

describe("employeePrompt", () => {
    it("speaks as the main agent, in the first person, and names the boss", () => {
        const prompt = employeePrompt("Mama Put", "Bola", [{ name: "Ada", live: true }]);
        expect(prompt).toContain("You are Ada, Mama Put's employee, talking to your boss, Bola");
        expect(prompt).toContain('The customer-facing agent named "Ada" IS you');
        expect(prompt).toContain("You're live");
        expect(prompt).not.toContain("colleagues");
    });

    it("says when it isn't serving customers, and lists the other staff as colleagues", () => {
        const prompt = employeePrompt("Mama Put", null, [{ name: "Ada", live: false }, { name: "Tolu", live: true }, { name: "Kemi", live: false }]);
        expect(prompt).toContain("You are Ada");
        expect(prompt).toContain("your boss, the owner");
        expect(prompt).toContain("You're not serving customers right now");
        expect(prompt).toContain("Your colleagues on the staff: Tolu, Kemi (not live)");
    });

    it("is the new hire, without a name, when there's no agent yet", () => {
        const prompt = employeePrompt(null, "Bola", []);
        expect(prompt).toContain("this business's new employee");
        expect(prompt).toContain("You don't have a name yet");
        expect(prompt).toContain("create_agent is you being set up");
    });
});

describe("employeePrompt and the business", () => {
    it("tells the employee to look the business up, never guess", () => {
        const prompt = employeePrompt("Mama Put", "Bola", [{ name: "Ada", live: true }]);
        expect(prompt).toContain("get_money, list_orders, list_bookings, list_customers, list_chats, read_chat");
        expect(prompt).toContain("never guess a figure");
    });
});
