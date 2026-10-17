"use client";

import { ArrowLeft, ArrowRight, MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type EntryStage = "loading" | "welcome" | "cards" | "final" | "leaving" | "done";
const cards = [
  { title: "LOG THE CITIES YOU’VE VISITED", text: "Build a personal record of the places that have shaped your travels." },
  { title: "RATE YOUR EXPERIENCE", text: "Score each city and see your favourites come to life across your map." },
  { title: "COMPARE WHAT MATTERS", text: "See how cities stack up across food, culture, architecture, nature, nightlife and more." },
];

function MapDrawing() {
  return <svg className="onboarding-map" viewBox="0 0 500 300" aria-hidden="true">
    <path d="M-20 220C90 170 90 255 180 185S280 155 320 95 450 120 520 35" className="map-river"/>
    <g className="map-streets" fill="none"><path d="M20 20 190 280M100 0 290 300M210 0 390 300M330 0 500 240M0 110 500 0M0 210 500 100M50 300 500 210"/><path d="M0 65 500 270M-20 150 350 300M145 0 500 150"/></g>
    {[[116,128],[239,90],[328,190],[400,72]].map(([x,y],i)=><g className="map-appear" key={x} style={{animationDelay:`${i*180}ms`}}><circle cx={x} cy={y} r="17" fill="#fafaf5"/><circle cx={x} cy={y} r="10" fill={["#236844","#62a461","#d4b849","#236844"][i]}/></g>)}
    <text x="138" y="132">Lisbon</text><text x="350" y="195">Kyoto</text>
  </svg>;
}

export default function Onboarding({stage,onStage,onAuth,onGuest,onComplete,notice}: {
  stage: EntryStage; onStage:(stage:EntryStage)=>void; onAuth:(mode:"signup"|"signin")=>void; onGuest:()=>void; onComplete:()=>void; notice:string;
}) {
  const [index,setIndex]=useState(0);
  const [rating,setRating]=useState(4.5);
  const [revealed,setRevealed]=useState(false);
  const touch=useRef<{x:number;y:number}|null>(null);
  const heading=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{heading.current?.focus();},[stage,index]);
  useEffect(()=>{if(stage==="cards")setIndex(0);},[stage]);
  useEffect(()=>{setRevealed(false);if(stage!=="final")return;const timer=setTimeout(()=>setRevealed(true),650);return()=>clearTimeout(timer);},[stage]);
  useEffect(()=>{if(stage!=="leaving")return;const timer=setTimeout(onComplete,500);return()=>clearTimeout(timer);},[stage,onComplete]);
  const next=()=>index<2?setIndex(index+1):onStage("final");
  if(stage==="done")return null;
  return <section className={`entry-layer entry-${stage}`} aria-label="Welcome to CityLog">
    <div className="entry-top">{stage!=="welcome"&&<span className="brand entry-brand"><span className="brand-mark"><MapPin size={18}/></span><span>citylog</span></span>}{stage==="cards"&&<button className="quiet-btn" onClick={()=>onStage("final")}>Skip</button>}</div>
    {stage==="loading"?<div className="entry-loading" role="status">Opening your world<span/></div>:stage==="welcome"?<div className="welcome-content">
      <div className="welcome-art"><MapDrawing/></div>
      <h1 className="brand welcome-brand" ref={heading} tabIndex={-1}><span className="brand-mark"><MapPin size={18}/></span><span>citylog</span></h1>
      <p className="entry-description">Your personal map of the cities you&apos;ve experienced.</p>
      <div className="welcome-actions"><button className="primary-btn" onClick={()=>onAuth("signup")}>Create account <ArrowRight/></button><button className="entry-secondary" onClick={()=>onAuth("signin")}>Sign in</button><button className="quiet-btn guest-choice" onClick={onGuest}>Continue as guest <ArrowRight/></button></div>
    </div>:stage==="cards"?<div className="onboarding-content" onTouchStart={e=>{touch.current={x:e.touches[0].clientX,y:e.touches[0].clientY};}} onTouchEnd={e=>{if(!touch.current)return;const dx=e.changedTouches[0].clientX-touch.current.x;const dy=e.changedTouches[0].clientY-touch.current.y;touch.current=null;if(Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.5){if(dx<0)next();else setIndex(Math.max(0,index-1));}}}>
      {notice&&<p className="onboarding-notice" role="status">{notice}</p>}
      <div className="onboarding-visual" key={index}>
        {index===0?<MapDrawing/>:index===1?<div className="rating-demo"><div className="rating-orbit"><span style={{background:rating>4.5?"#236844":rating>4?"#62a461":rating>3?"#d4b849":rating>2?"#e28a43":"#cd554f"}}/></div><strong>{rating.toFixed(1)} <small>★</small></strong><label>Try a rating<input aria-label="Try a city rating" type="range" min="1" max="5" step="0.5" value={rating} onTouchStart={e=>e.stopPropagation()} onTouchEnd={e=>e.stopPropagation()} onChange={e=>setRating(Number(e.target.value))}/></label></div>:<div className="comparison-demo">{[{name:"Lisbon",scores:[4.5,4,5]},{name:"Kyoto",scores:[5,5,4.5]}].map(city=><article key={city.name}><span className="mini-city-line"/><h3>{city.name}</h3>{city.scores.map((score,i)=><div key={i}><span>{["Food","Culture","Architecture"][i]}</span><b>{score.toFixed(1)}</b><i style={{width:`${score*20}%`}}/></div>)}</article>)}</div>}
      </div>
      <div className="onboarding-copy"><p className="kicker">0{index+1} / 03</p><h1 ref={heading} tabIndex={-1}>{cards[index].title}</h1><p>{cards[index].text}</p></div>
      <div className="onboarding-navigation"><button className="quiet-btn" aria-label="Previous card" disabled={index===0} onClick={()=>setIndex(index-1)}><ArrowLeft/></button><div className="onboarding-dots" aria-label={`Card ${index+1} of 3`}>{cards.map((_,i)=><button key={i} aria-label={`Go to card ${i+1}`} aria-current={i===index?"step":undefined} onClick={()=>setIndex(i)}/>)}</div><button className="quiet-btn" onClick={next}>Next <ArrowRight/></button></div>
    </div>:<div className="onboarding-finale"><p className="kicker">EVERY CITY. YOUR PERSPECTIVE.</p><h1 ref={heading} tabIndex={-1}>THE WORLD,<br/><em>ACCORDING<br/>TO YOU.</em></h1><button className={`final-start ${revealed?"revealed":""}`} disabled={!revealed} onClick={()=>onStage("leaving")}>START YOUR MAP <ArrowRight/></button></div>}
    {stage==="welcome"&&<footer className="entry-legal"><a href="https://citylogger.app/privacy">Privacy</a><a href="https://citylogger.app/support">Support</a></footer>}
  </section>;
}
