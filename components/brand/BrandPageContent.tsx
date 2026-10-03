import Image from "next/image";
import { DownloadCircle01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

export default function BrandPageContent() {
    return (
        <main className="container mx-auto max-w-6xl pt-24 pb-32 px-4">
            <h1 className="text-center font-inter text-5xl font-bold">Brand System</h1>
            <section className="mx-auto mt-16 max-w-2xl text-left font-inter">
                <h2 className="text-3xl font-semibold">Preface</h2>
                <p className="mt-4 text-[1rem] leading-relaxed tracking-[-0.005em] text-white">
                    The &ldquo;Cencori&rdquo; brand system is the identity of
                    Cencori Inc. &mdash; our name, wordmark, icon, and the
                    standards that hold them together on every surface. It is a
                    property of Cencori Inc.
                </p>
                <p className="mt-4 text-[1rem] leading-relaxed tracking-[-0.005em] text-white">
                    It exists so our customers, developers, and partners can use
                    our brand work effectively in their own products and assets:
                    represent Cencori accurately, keep the marks intact, and keep
                    it clear who built what.
                </p>
                <p className="mt-4 text-[1rem] leading-relaxed tracking-[-0.005em] text-white">
                    If you need any help, please{" "}
                    <a href="/brand#contact" className="underline underline-offset-4">
                        contact us
                    </a>
                    .
                </p>
            </section>
            <section className="mx-auto mt-16 max-w-2xl text-left font-inter">
                <div className="flex items-center justify-between">
                    <h2 className="text-3xl font-semibold">Symbol</h2>
                    <a
                        href="/cencori-logos.zip"
                        download
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/[0.12] px-2 py-1.5 text-[13px] font-medium tracking-[-0.005em] text-white transition-colors hover:bg-white/20 whitespace-nowrap"
                    >
                        <HugeiconsIcon icon={DownloadCircle01Icon} size={14} strokeWidth={1.9} />
                        Download assets
                    </a>
                </div>
                <p className="mt-4 text-[1rem] leading-relaxed tracking-[-0.005em] text-white">
                    Quantum is the name of the Cencori symbol &mdash; the
                    four-circle mark that stands in for the company where words
                    don&apos;t fit.
                </p>
                <p className="mt-4 text-[1rem] leading-relaxed tracking-[-0.005em] text-white">
                    It leads in small spaces: avatars, favicons, app icons, and
                    anything the wordmark can&apos;t fit. Use the artwork from
                    this page and don&apos;t redraw it.
                </p>
                <div className="mt-6 grid grid-cols-1 overflow-hidden rounded-xl border border-white/10">
                    <div className="flex aspect-[21/9] items-center justify-center bg-white p-8">
                        <Image
                            src="/logos/icon-black.svg"
                            alt="Cencori logo — black"
                            width={200}
                            height={200}
                            loading="eager"
                            className="h-auto w-full max-w-[50px] object-contain"
                        />
                    </div>
                    <div className="flex aspect-[21/9] items-center justify-center border-t border-white/10 bg-black p-8">
                        <Image
                            src="/logos/icon-white.svg"
                            alt="Cencori logo — white"
                            width={200}
                            height={200}
                            loading="eager"
                            className="h-auto w-full max-w-[50px] object-contain"
                        />
                    </div>
                </div>
            </section>
            <section className="mx-auto mt-16 max-w-2xl text-left font-inter">
                <h2 className="text-3xl font-semibold">wordmark</h2>
                <p className="mt-4 text-[1rem] leading-relaxed tracking-[-0.005em] text-white">
                    Sexy is the name of the Cencori wordmark &mdash; the
                    technical representation of what the company identifies as,
                    the name set exactly, with nothing added and nothing
                    removed.
                </p>
                <p className="mt-4 text-[1rem] leading-relaxed tracking-[-0.005em] text-white">
                    It is how the company signs its work across product, web, and
                    print. Use the artwork from this page and keep its geometry
                    intact.
                </p>
                <div className="mt-6 grid grid-cols-1 overflow-hidden rounded-xl border border-white/10">
                    <div className="flex aspect-[21/9] items-center justify-center bg-white p-8">
                        <Image
                            src="/logos/b.png"
                            alt="Cencori wordmark — black"
                            width={480}
                            height={58}
                            loading="eager"
                            className="h-auto w-full max-w-[320px] object-contain"
                        />
                    </div>
                    <div className="flex aspect-[21/9] items-center justify-center border-t border-white/10 bg-black p-8">
                        <Image
                            src="/logos/w.png"
                            alt="Cencori wordmark — white"
                            width={480}
                            height={58}
                            loading="eager"
                            className="h-auto w-full max-w-[320px] object-contain"
                        />
                    </div>
                </div>
            </section>
            <section className="mx-auto mt-16 max-w-2xl text-left font-inter">
                <h2 className="text-3xl font-semibold">Usage</h2>
                <div className="mt-6 grid grid-cols-1 gap-8 sm:grid-cols-2">
                    <div>
                        <p className="text-sm font-semibold tracking-wide">Dos</p>
                        <ul className="mt-4 space-y-3 text-[1rem] leading-relaxed tracking-[-0.005em] text-white">
                            <li>Use the artwork from this page, unaltered.</li>
                            <li>White mark on dark, black mark on light.</li>
                            <li>Give the marks generous clear space.</li>
                            <li>Keep the geometry exactly as shipped.</li>
                        </ul>
                    </div>
                    <div>
                        <p className="text-sm font-semibold tracking-wide">Don&apos;ts</p>
                        <ul className="mt-4 space-y-3 text-[1rem] leading-relaxed tracking-[-0.005em] text-white">
                            <li>Don&apos;t stretch, rotate, or rearrange.</li>
                            <li>Don&apos;t recolor or add effects.</li>
                            <li>Don&apos;t place on busy backgrounds.</li>
                            <li>Don&apos;t pair with other marks.</li>
                            <li>Don&apos;t use Quantum with the wordmark.</li>
                        </ul>
                    </div>
                </div>
            </section>
            <section className="mx-auto mt-16 max-w-2xl text-left font-inter">
                <h2 className="text-3xl font-semibold">Press</h2>
                <p className="mt-4 text-[1rem] leading-relaxed tracking-[-0.005em] text-white">
                    When addressing Cencori in the press, describe us as a deep
                    technology company building the computing infrastructure AI
                    runs on.
                </p>
                <p className="mt-4 text-[1rem] leading-relaxed tracking-[-0.005em] text-white">
                    For articles and announcements, you may use this boilerplate:
                    Cencori Inc. is a deep technology company building the
                    computing infrastructure AI runs on. 
                </p>
                <p className="mt-4 text-[1rem] leading-relaxed tracking-[-0.005em] text-white">
                    Refer to the company as Cencori. Don&apos;t abbreviate,
                    pluralize, or reword the name, and write product names
                    exactly as they appear on cencori.com.
                </p>
                <p className="mt-4 text-[1rem] leading-relaxed tracking-[-0.005em] text-white">
                    If that doesn&apos;t fit your piece,{" "}
                    <a href="/brand#contact" className="underline underline-offset-4">
                        contact us
                    </a>{" "}
                    and we&apos;ll agree on language that does.
                </p>
            </section>
            <section id="contact" className="mx-auto mt-16 max-w-2xl scroll-mt-24 text-left font-inter">
                <h2 className="text-3xl font-semibold">Contact</h2>
                <p className="mt-4 text-[1rem] leading-relaxed tracking-[-0.005em] text-white">
                    If you have any questions about the system, or need help
                    setting up branding, reach out to{" "}
                    <a
                        href="mailto:bola@cencori.com"
                        className="underline underline-offset-4"
                    >
                        bola@cencori.com
                    </a>
                    .
                </p>
            </section>
        </main>
    );
}
