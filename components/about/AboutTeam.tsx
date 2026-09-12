import Image from "next/image";
import styles from "./AboutTeam.module.css";

const TEAM = [
  {
    name: "Bola Banjo",
    title: "CEO & Co-founder",
    src: "/downloads/bb.jpg",
    alt: "Portrait of Bola Banjo",
    sizes: "(max-width: 700px) 100vw, 50vw",
  },
  {
    name: "Daniel Oreofe",
    title: "COO & Co-founder",
    src: "/daniel-avatar.png",
    alt: "Portrait of Daniel Oreofe",
    sizes: "(max-width: 700px) 100vw, 50vw",
  },
];

export function AboutTeam() {
  return (
    <section className={styles.team} aria-labelledby="about-team-title">
      <div className={styles.pin}>
        <p className={styles.label} id="about-team-title">
          Team
        </p>
        <div className={styles.grid}>
          {TEAM.map((member) => (
            <figure className={styles.card} key={member.name}>
              <Image
                alt={member.alt}
                className={styles.image}
                fill
                sizes={member.sizes}
                src={member.src}
              />
              <div className={styles.scrim} aria-hidden="true" />
              <figcaption className={styles.meta}>
                <p className={styles.name}>{member.name}</p>
                <p className={styles.role}>{member.title}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
