import Image from "next/image";
import { Author } from "@/lib/blog";

interface AuthorBadgeProps {
    author: Author;
    size?: "sm" | "md" | "lg";
    showBio?: boolean;
}

export function AuthorBadge({ author, size = "md", showBio = false }: AuthorBadgeProps) {
    const sizeClasses = {
        sm: "h-8 w-8",
        md: "h-10 w-10",
        lg: "h-12 w-12",
    };

    const textSizeClasses = {
        sm: "text-sm",
        md: "text-base",
        lg: "text-lg",
    };

    return (
        <div className="flex items-start gap-3">
            {/* Avatar */}
            <div className={`relative ${sizeClasses[size]} rounded-full overflow-hidden flex-shrink-0`}>
                {author.avatar ? (
                    <Image
                        src={author.avatar}
                        alt={author.name}
                        fill
                        className="object-cover"
                    />
                ) : (
                    <div className="w-full h-full bg-primary/20 flex items-center justify-center font-semibold text-primary">
                        {author.name.slice(0, 2).toUpperCase()}
                    </div>
                )}
            </div>

            {/* Info */}
            <div className="flex-1">
                <div className={`font-semibold ${textSizeClasses[size]}`}>
                    {author.name}
                </div>
                <div className="text-xs text-muted-foreground">
                    {author.role}
                </div>
                {showBio && author.bio && (
                    <p className="text-sm text-muted-foreground mt-1">
                        {author.bio}
                    </p>
                )}
            </div>
        </div>
    );
}
