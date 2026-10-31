import { describe, expect, it } from "vitest";
import { withoutCatchUpNote } from "@/lib/studio/takeover";

describe("withoutCatchUpNote", () => {
    it("strips the note in both its old and new wording, leaving the customer's message", () => {
        const old = "[While you were paused, the business owner talked with the customer directly:\nOwner: hi\nCarry on from there; don't repeat what the owner already said.]\n\nIs the jollof ready?";
        const fresh = "[Since your last reply, these messages were sent in this chat:\nYou (passed on for the owner): Your order is on the way\nCarry on from there; don't repeat what was already said.]\n\nThanks!";
        expect(withoutCatchUpNote(old)).toBe("Is the jollof ready?");
        expect(withoutCatchUpNote(fresh)).toBe("Thanks!");
        expect(withoutCatchUpNote("Just a message")).toBe("Just a message");
    });
});

import { manualMessages } from "@/lib/studio/takeover";

describe("manualMessages", () => {
    it("keeps what the assistant passed on for the owner, so adding the next message doesn't drop it", () => {
        const list = manualMessages({ manual_messages: [
            { id: "1", from: "customer", text: "hi", at: "a" },
            { id: "2", from: "assistant", text: "Your order is on the way", at: "b" },
            { id: "3", from: "owner", text: "Thanks for waiting", at: "c" },
            { id: "4", from: "someone", text: "?", at: "d" },
        ] });
        expect(list.map((message) => message.id)).toEqual(["1", "2", "3"]);
    });
});
