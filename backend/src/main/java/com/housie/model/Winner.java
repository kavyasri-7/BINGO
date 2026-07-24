package com.housie.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "winners")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Winner {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String roomCode;

    @Column(nullable = false)
    private String userUid;

    @Column(nullable = false)
    private String nickname;

    @Column(nullable = false)
    private String category; // Early Five, Top Line, Middle Line, Bottom Line, Full House

    @Column(nullable = false)
    private LocalDateTime winningTime;
}
