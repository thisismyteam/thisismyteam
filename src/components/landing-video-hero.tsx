import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Btn } from "@/components/ui-kit";

export function LandingVideoHero() {
  const stageRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const stage = stageRef.current;
    const video = videoRef.current;
    if (!stage || !video) return;

    const beats = [...stage.querySelectorAll<HTMLElement>(".beat")];
    const words = [...stage.querySelectorAll<HTMLElement>(".q span[data-at]")];
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;

    function tick() {
      const reduce = motionQuery.matches;
      const t = reduce ? 15.5 : video?.currentTime || 0;
      for (const beat of beats) {
        const on = t >= Number(beat.dataset['in']) && t < Number(beat.dataset['out']);
        if (on !== beat.classList.contains("on")) beat.classList.toggle("on", on);
      }
      for (const word of words) {
        const on = !reduce && t >= Number(word.dataset['at']) && t < 2.0;
        if (on !== word.classList.contains("on")) word.classList.toggle("on", on);
      }
      frame = requestAnimationFrame(tick);
    }

    function syncMotion() {
      if (!video) return;
      if (motionQuery.matches) {
        video.pause();
        if (video.readyState >= 1) video.currentTime = 15.5;
      } else {
        const play = video.play();
        if (play && play.catch) play.catch(() => {});
      }
    }

    video.addEventListener("loadedmetadata", syncMotion);
    motionQuery.addEventListener("change", syncMotion);
    syncMotion();
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      video.removeEventListener("loadedmetadata", syncMotion);
      motionQuery.removeEventListener("change", syncMotion);
    };
  }, []);

  return (
    <>
      <div className="promo-stage" ref={stageRef} aria-label="This Is My Team introduction">
        <video ref={videoRef} poster="/hero-poster.jpg" autoPlay muted loop playsInline preload="auto" aria-hidden="true">
          <source src="/hero.mp4" type="video/mp4" />
          <source src="/hero.webm" type="video/webm" />
        </video>
        <div className="grade" />
        <div className="grain" />
        <div className="beat q" data-in="0" data-out="2.0">
          <span data-at="0.15">Who's</span>
          <span data-at="0.65">number</span>
          <span className="n23" data-at="1.15">23?</span>
        </div>
        <div className="beat ghost" data-in="3.0" data-out="3.8">76</div>
        <div className="beat ghost" data-in="3.8" data-out="4.6">52</div>
        <div className="beat tag wipe" data-in="3.0" data-out="4.6"><div className="big">Know every <em>number.</em></div></div>
        <div className="beat tag wipe" data-in="4.6" data-out="6.4"><div className="big">Watch every <em>highlight.</em></div></div>
        <div className="beat corner wipe" data-in="6.4" data-out="8.4"><div className="big">Know the players.</div></div>
        <div className="beat namebar wipe" data-in="6.7" data-out="8.4">
          <div className="num">15</div>
          <div className="who"><b>Luca Brenner</b><small>QB / Jr / Beverly Hills Normans</small></div>
        </div>
        <div className="beat tag wipe" data-in="8.4" data-out="9.9"><div className="big">Know the <em>coaches.</em></div></div>
        <div className="beat tag wipe" data-in="9.9" data-out="11.2"><div className="big">Be part of <em>it.</em></div></div>
        <div className="beat flick slam" data-in="11.2" data-out="11.6"><div className="big">Schedules.</div></div>
        <div className="beat flick slam" data-in="11.6" data-out="12.0"><div className="big">Stats.</div></div>
        <div className="beat flick slam" data-in="12.0" data-out="12.4"><div className="big">Scores.</div></div>
        <div className="beat center slam" data-in="12.4" data-out="13.3"><div className="big">Every team.</div></div>
        <div className="beat center slam" data-in="13.3" data-out="14.2"><div className="big">Every player.</div></div>
        <div className="beat center slam" data-in="14.2" data-out="15.4"><div className="big xl">This is <span className="or">my</span> team.</div></div>
        <div className="beat endcard" data-in="15.4" data-out="99">
          <div className="line">Every team deserves to be <em>seen.</em></div>
          <div className="sports" aria-label="Football, basketball, soccer">
            <svg viewBox="0 0 24 24"><ellipse cx="12" cy="12" rx="10" ry="6" transform="rotate(-35 12 12)"/><path d="M9 15l6-6M10 11l1 1M12 9l1 1M11 13l1 1"/></svg>
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.5"/><path d="M2.5 12h19M12 2.5v19M5.3 5.3c3 3 3 10.4 0 13.4M18.7 5.3c-3 3-3 10.4 0 13.4"/></svg>
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.5"/><path d="M12 7.5l4 3-1.5 4.5h-5L8 10.5z"/><path d="M12 7.5V3M16 10.5l4.5-1.5M14.5 15l2.5 4M9.5 15L7 19M8 10.5L3.5 9"/></svg>
          </div>
          <div className="mark"><i />This Is My Team<i /></div>
          <Btn className="cta" onClick={() => navigate({ to: "/auth", search: { mode: "signup" } })}>Create My Team</Btn>
        </div>
      </div>
      <p className="px-4 pt-2 text-right text-xs text-muted-foreground">Footage: LOCK'N Media</p>
    </>
  );
}